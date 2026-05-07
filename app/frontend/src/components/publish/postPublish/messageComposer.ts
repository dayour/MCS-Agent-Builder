/**
 * Post-publish message composer.
 *
 * Hybrid approach:
 *  - Deterministic: copy fields, suggestion pills, channel tier (from registry)
 *  - LLM-generated: celebration message text (using channel guidance as prompt hint)
 */

import type { PostPublishChannelConfig, PostPublishAction, CopyValueAction } from './types';
import { getPostPublishConfig } from './channelRegistry';
import { callModel } from '../../../utils/modelClient';

// ── Template interpolation ──────────────────────────────────────────────────

export interface PostPublishContext {
  agentId?: string;
  agentName?: string;
  /** SharePoint site URL (for the SharePoint channel) */
  siteUrl?: string;
  /** Demo website URL */
  demoUrl?: string;
  /** Facebook webhook callback URL */
  callbackUrl?: string;
  /** Facebook webhook verify token */
  verifyToken?: string;
  /** Token endpoint for 3rd-party integrations */
  tokenEndpoint?: string;
  /** SDK connection string */
  connectionString?: string;
  /** Azure Bot Framework Bot ID */
  botId?: string;
  /** Azure Bot Framework App ID */
  appId?: string;
  /** External docs URL */
  docsUrl?: string;
}

/**
 * Example placeholder values shown when real values aren't provided.
 * Follow MS resource-ID conventions (e.g. GUID-like segments, URL patterns).
 */
const PLACEHOLDER_VALUES: Record<string, string> = {
  tokenEndpoint: 'https://a1b2c3d4.api.copilot.microsoft.com/token/e5f6-7890-abcd',
  connectionString: 'endpoint=https://a1b2c3d4.api.copilot.microsoft.com;key=E5F6G7H8-90AB-CDEF-1234-56789ABCDE00',
  botId: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  appId: 'F9E8D7C6-B5A4-3210-FEDC-BA9876543210',
  callbackUrl: 'https://a1b2c3d4.api.copilot.microsoft.com/webhook/callback',
  verifyToken: 'cplt_verify_A1B2C3D4E5F67890',
  demoUrl: 'https://copilot.microsoft.com/demo/a1b2c3d4',
  siteUrl: 'https://contoso.sharepoint.com/sites/agents',
  docsUrl: 'https://learn.microsoft.com/copilot-studio/connect',
};

function interpolate(template: string, ctx: PostPublishContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    // Keys are controlled by the channel registry, not user input
    const value = ctx[key as keyof PostPublishContext];
    return value ?? PLACEHOLDER_VALUES[key] ?? `{{${key}}}`;
  });
}

function resolveAction(action: PostPublishAction, ctx: PostPublishContext): PostPublishAction {
  switch (action.type) {
    case 'navigate':
      return { ...action, urlTemplate: interpolate(action.urlTemplate, ctx) };
    case 'copy-value':
      return { ...action, valueTemplate: interpolate(action.valueTemplate, ctx) } as CopyValueAction;
    case 'external-docs':
      return { ...action, docsUrl: interpolate(action.docsUrl, ctx) };
    default:
      return action;
  }
}

// ── Resolved config ─────────────────────────────────────────────────────────

export interface ResolvedPostPublishConfig {
  channelKey: string;
  displayName: string;
  tier: PostPublishChannelConfig['tier'];
  guidance: string;
  actions: PostPublishAction[];
}

/**
 * Looks up the channel's post-publish config and resolves all templates.
 * Returns `null` if the channel key isn't recognized.
 */
export function resolvePostPublishConfig(
  channelKey: string,
  ctx: PostPublishContext = {},
): ResolvedPostPublishConfig | null {
  const config = getPostPublishConfig(channelKey);
  if (!config) return null;

  return {
    channelKey: config.channelKey,
    displayName: config.displayName,
    tier: config.tier,
    guidance: config.guidance,
    actions: config.actions.map(a => resolveAction(a, ctx)),
  };
}

// ── Helper Agent post-publish message ────────────────────────────────────────

/** A field the maker needs to copy — rendered as a read-only CopilotInput. */
export interface PostPublishCopyField {
  label: string;
  value: string;
}

/** Convert non-copy-value actions into suggestion pill labels. */
function actionToSuggestion(action: PostPublishAction): string {
  return action.type === 'copy-value' ? '' : action.label;
}

export interface PostPublishMessageResult {
  content: string;
  suggestions: string[];
  /** Fields rendered as read-only inputs with copy buttons in the HA chat. */
  copyFields: PostPublishCopyField[];
}

// ── Deterministic structure ─────────────────────────────────────────────────

/**
 * Extracts the deterministic parts of the post-publish message:
 * copy fields, suggestion pills, and the guidance hint.
 *
 * Does NOT generate the message text — that's done by `composePostPublishMessage`.
 */
export function getPostPublishStructure(
  channelKey: string | undefined,
  ctx: PostPublishContext = {},
): { guidance: string; suggestions: string[]; copyFields: PostPublishCopyField[] } {
  if (!channelKey) {
    return { guidance: '', suggestions: ['Help me share this', 'Help me set up monitoring'], copyFields: [] };
  }

  const resolved = resolvePostPublishConfig(channelKey, ctx);
  if (!resolved) {
    return { guidance: '', suggestions: ['Help me share this', 'Help me set up monitoring'], copyFields: [] };
  }

  const copyFields: PostPublishCopyField[] = resolved.actions
    .filter((a): a is CopyValueAction => a.type === 'copy-value')
    // valueTemplate is already resolved (interpolated) at this point
    .map(a => ({ label: a.fieldLabel, value: a.valueTemplate }));

  const suggestions = resolved.actions
    .filter(a => a.type !== 'copy-value')
    .map(actionToSuggestion)
    .filter(Boolean);

  return { guidance: resolved.guidance, suggestions, copyFields };
}

// ── LLM-generated message ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Copilot Studio's Helper Agent. The maker just published their agent successfully.

Write a short, celebratory message (1–2 sentences max). Rules:
- Start with "🎉 **{agentName} is live!**" (use the exact agent name provided).
- Follow with one sentence about what to do next, based on the guidance provided.
- Keep it warm but concise — no filler, no bullet points, no headings.
- Do NOT mention copy fields or suggestion pills — those are rendered separately.
- Do NOT use markdown other than the bold agent name in the header.`;

/**
 * Composes the post-publish message using a fast LLM call for the text,
 * combined with deterministic copy fields and suggestion pills.
 *
 * Falls back to a static message if the LLM call fails.
 */
export async function composePostPublishMessage(
  agentName: string,
  channelKey: string | undefined,
  ctx: PostPublishContext = {},
): Promise<PostPublishMessageResult> {
  const { guidance, suggestions, copyFields } = getPostPublishStructure(channelKey, ctx);

  const fallback = guidance
    ? `🎉 **${agentName} is live!**\n\n${guidance}`
    : `🎉 **${agentName} is live!**`;

  if (!guidance) {
    return { content: fallback, suggestions, copyFields };
  }

  try {
    const content = (await callModel({
      model: 'fast',
      maxTokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Agent name: ${agentName}\nChannel: ${channelKey}\nGuidance: ${guidance}`,
      }],
    })).trim();

    return { content, suggestions, copyFields };
  } catch {
    return { content: fallback, suggestions, copyFields };
  }
}
