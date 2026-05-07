import Anthropic from '@anthropic-ai/sdk';
import { getActiveEndpoint, EndpointDefinition, ModelTier } from '../config/endpointConfig';

// ── Multimodal content block types ────────────────────────────────────────────

export type TextBlock = { type: 'text'; text: string };
export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};
export type ContentBlock = TextBlock | ImageBlock;

/** Message content: plain string for text-only, ContentBlock[] for multimodal. */
export type MessageContent = string | ContentBlock[];

// ── Params ────────────────────────────────────────────────────────────────────

export interface ModelCallParams {
  /**
   * Tier name ('fast' | 'balanced' | 'capable') or legacy model ID string.
   * Legacy IDs are resolved to a tier automatically — see resolveModel below.
   */
  model: string;
  maxTokens: number;
  system?: string;
  /**
   * Conversation turns. `content` can be a plain string for text-only calls,
   * or an array of ContentBlock objects for multimodal calls (e.g. image + text).
   * Both Anthropic (inline) and GitHub Copilot (via temp-file attachments) support images.
   */
  messages: Array<{ role: 'user' | 'assistant'; content: MessageContent }>;
  temperature?: number;
  /**
   * When true, the server injects the full MCS knowledge cache (~48K tokens)
   * into the system prompt. Use for the main chat flow where MCS expertise
   * is needed. Omit for small specialized calls (repair diagnosis, etc.).
   */
  mcsKnowledge?: boolean;
}

/** One Anthropic client instance per endpoint ID — reused across calls */
const clientCache = new Map<string, Anthropic>();

/**
 * Maps a model string to the active endpoint's concrete model ID.
 *
 * Tier resolution order:
 *  1. Exact tier name ('fast' | 'balanced' | 'capable') → used directly
 *  2. String contains 'haiku'   → fast
 *  3. String contains 'opus'    → capable
 *  4. Anything else (sonnet, gpt-*, unknown) → balanced
 */
function resolveModel(modelInput: string, ep: EndpointDefinition): string {
  let tier: ModelTier;
  if (modelInput === 'fast' || modelInput === 'balanced' || modelInput === 'capable') {
    tier = modelInput;
  } else if (modelInput.includes('haiku')) {
    tier = 'fast';
  } else if (modelInput.includes('opus')) {
    tier = 'capable';
  } else {
    console.debug(`[callModel] Unknown model "${modelInput}" — falling back to balanced tier`);
    tier = 'balanced';
  }

  return ep.models[tier];
}

class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

/** Delay helper */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Adds Anthropic cache_control breakpoint to the last message for multi-turn
 * conversations. Handles both string and ContentBlock[] message content.
 */
function applyCacheControl(messages: ModelCallParams['messages']) {
  if (messages.length <= 1) return messages;

  return messages.map((msg, idx) => {
    if (idx !== messages.length - 1) return msg;

    const { content } = msg;
    if (typeof content === 'string') {
      // String content → wrap in a text block with cache_control
      return {
        role: msg.role,
        content: [{ type: 'text' as const, text: content, cache_control: { type: 'ephemeral' as const } }],
      };
    }

    // ContentBlock[] → add cache_control to the last text block
    if (content.length === 0) return msg;

    let lastTextIndex = -1;
    for (let i = content.length - 1; i >= 0; i--) {
      if (content[i].type === 'text') { lastTextIndex = i; break; }
    }

    if (lastTextIndex === -1) return msg; // no text blocks → skip cache_control

    return {
      role: msg.role,
      content: content.map((block, i) =>
        i === lastTextIndex
          ? { ...block, cache_control: { type: 'ephemeral' as const } }
          : block,
      ),
    };
  });
}

/**
 * Converts messages to OpenAI-compatible content-block format and applies
 * cache_control hints on the last text block of the last message.
 * COLIN passes these through to Anthropic; non-Anthropic profiles drop them silently.
 */
function applyCacheControlOpenAI(messages: ModelCallParams['messages']): Array<Record<string, unknown>> {
  if (messages.length === 0) return [];

  return messages.map((msg, msgIdx) => {
    const { content } = msg;

    // Convert string content to content-block array
    const blocks: Record<string, unknown>[] = typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : content.map(block => {
          if (block.type === 'text') return { type: 'text', text: block.text };
          if (block.type === 'image') return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } };
          throw new Error(`[applyCacheControlOpenAI] Unknown content block type: ${(block as any).type}`);
        });

    // Add cache_control to last text block of last message
    if (msgIdx === messages.length - 1 && blocks.length > 0) {
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].type === 'text') {
          blocks[i] = { ...blocks[i], cache_control: { type: 'ephemeral' } };
          break;
        }
      }
    }

    return { role: msg.role, content: blocks };
  });
}

/** Image payload sent to the Copilot proxy for temp-file-based attachments. */
interface ProxyImage {
  media_type: string;
  data: string;  // base64
}

/**
 * Separates messages into plain-text messages and extracted images.
 * Text blocks are joined; image blocks are collected into a separate array
 * so the Copilot proxy can write them to temp files and pass as attachments.
 */
function extractMessagesAndImages(messages: ModelCallParams['messages']): {
  textMessages: Array<{ role: string; content: string }>;
  images: ProxyImage[];
} {
  const images: ProxyImage[] = [];

  const textMessages = messages.map(msg => {
    if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };

    const textParts: string[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'image') {
        images.push({ media_type: block.source.media_type, data: block.source.data });
      }
    }

    return { role: msg.role, content: textParts.join('\n') };
  });

  return { textMessages, images };
}

/** URL of the local server proxy for GitHub Copilot SDK calls */
const COPILOT_PROXY_URL = '/api/copilot/chat';

/**
 * Universal model call function. Returns the generated text string.
 *
 * Retries up to 3 times with exponential backoff on transient errors.
 *
 * Error handling contract:
 *  - callModel logs the error with context (resolved model ID, endpoint ID) before re-throwing.
 *  - The original error is always re-thrown unmodified so callers retain full control.
 *  - Callers are still responsible for: fallback/default values, UI state cleanup
 *    (e.g. setIsProcessing(false)), and any user-facing error messages.
 */
export async function callModel(params: ModelCallParams): Promise<string> {
  const ep = getActiveEndpoint();
  const resolvedModel = resolveModel(params.model, ep);

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ── SWA Proxy (COLIN model router) ──────────────────────────────
      if (ep.provider === 'swa-proxy') {
        const systemMessage = params.system !== undefined
          ? [{ role: 'system', content: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }] }]
          : [];
        const openAIMessages = [...systemMessage, ...applyCacheControlOpenAI(params.messages)];

        const body: Record<string, unknown> = {
          model: resolvedModel,
          max_tokens: params.maxTokens,
          messages: openAIMessages,
        };
        if (params.temperature !== undefined) body.temperature = params.temperature;

        const swaHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (process.env.REACT_APP_APP_SECRET_KEY) {
          swaHeaders['x-app-key'] = process.env.REACT_APP_APP_SECRET_KEY;
        }

        const res = await fetch('/api/model', {
          method: 'POST',
          headers: swaHeaders,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new HttpError(`[callModel] SWA proxy returned ${res.status}: ${errorBody}`, res.status);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content ?? '';
      }

      // ── Anthropic (direct SDK) ────────────────────────────────────────
      if (ep.provider === 'anthropic') {
        if (!clientCache.has(ep.id)) {
          clientCache.set(
            ep.id,
            new Anthropic({
              apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
              dangerouslyAllowBrowser: true,
            })
          );
        }
        const client = clientCache.get(ep.id);
        if (!client) {
          throw new Error(`Failed to initialize Anthropic client for endpoint "${ep.id}"`);
        }

        const cachedMessages = applyCacheControl(params.messages);

        const createParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
          model: resolvedModel,
          max_tokens: params.maxTokens,
          messages: cachedMessages as Anthropic.Messages.MessageCreateParamsNonStreaming['messages'],
        };
        if (params.system !== undefined) {
          createParams.system = [{ type: 'text' as const, text: params.system, cache_control: { type: 'ephemeral' as const } }];
        }
        if (params.temperature !== undefined) {
          createParams.temperature = params.temperature;
        }

        const response = await client.messages.create(createParams);
        const firstContent = response.content?.[0];
        return firstContent?.type === 'text' ? firstContent.text : '';
      }

      // ── GitHub Copilot (server proxy) ─────────────────────────────────
      if (ep.provider === 'github-copilot') {
        const { textMessages, images } = extractMessagesAndImages(params.messages);

        const body: Record<string, unknown> = {
          model: resolvedModel,
          maxTokens: params.maxTokens,
          messages: textMessages,
        };
        if (images.length > 0) body.images = images;
        if (params.system !== undefined) body.system = params.system;
        if (params.temperature !== undefined) body.temperature = params.temperature;
        if (params.mcsKnowledge) body.mcsKnowledge = true;

        const res = await fetch(COPILOT_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new HttpError(`[callModel] Copilot proxy returned ${res.status}: ${errorBody}`, res.status);
        }

        const data = await res.json();
        return data.text ?? '';
      }

      // ── Unknown provider ──────────────────────────────────────────────
      throw new Error(
        `Provider "${ep.provider}" is not yet implemented. Add a dispatch branch in callModel().`
      );
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined;
      const isOverloaded = status === 529;
      const isRateLimited = status === 429;
      const isRetryable = isOverloaded || isRateLimited || status === 503 || status === 502;

      if (isRetryable && attempt < MAX_RETRIES) {
        const baseDelay = isRateLimited ? 3000 : 1000;
        const delay = Math.pow(2, attempt) * baseDelay;
        console.warn(`[callModel] API ${isRateLimited ? 'rate-limited' : 'overloaded'} (${status}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }

      console.error('[callModel] Inference failed', {
        inputModel: params.model,
        resolvedModel,
        endpoint: ep.id,
      }, err);
      throw err;
    }
  }

  // Unreachable — loop always returns or throws
  throw new Error('[callModel] Unexpected exit from retry loop');
}
