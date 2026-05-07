export type Provider = 'anthropic' | 'openai' | 'azure-openai' | 'github-copilot' | 'swa-proxy';
export type ModelTier = 'fast' | 'balanced' | 'capable';

export interface EndpointDefinition {
  id: string;
  label: string;
  provider: Provider;
  /** For Azure or custom proxy */
  baseUrl?: string;
  /**
   * Documentation only — CRA requires static env var references at build time,
   * so modelClient.ts hardcodes process.env.REACT_APP_ANTHROPIC_API_KEY rather
   * than using process.env[ep.apiKeyEnvVar]. Update both if adding a provider.
   */
  apiKeyEnvVar: string;
  models: Record<ModelTier, string>;
}

/**
 * Available model choices per tier when using GitHub Copilot SDK.
 *
 * The GPT entries here are static fallbacks for surfaces that can't await an
 * async fetch (settings modal, nav rail). They should track the floor in
 * `tools/lib/openai.js` (KNOWN_LATEST_GPT). For UI surfaces that can render
 * the live discovered id, prefer the `useModelCatalog` hook — it pulls
 * whatever the backend resolved, including future versions like gpt-5.6,
 * without code changes here.
 */
export const COPILOT_TIER_OPTIONS: Record<ModelTier, { id: string; label: string }[]> = {
  fast:     [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { id: 'gpt-5-mini',       label: 'GPT-5 mini' },
  ],
  balanced: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'gpt-5',             label: 'GPT-5' },
  ],
  capable:  [
    { id: 'claude-opus-4-7',   label: 'Claude Opus 4.7' },
    { id: 'gpt',               label: 'GPT (latest)' },
  ],
};

export const ENDPOINTS: EndpointDefinition[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    provider: 'anthropic',
    apiKeyEnvVar: 'REACT_APP_ANTHROPIC_API_KEY',
    models: {
      fast:     'claude-haiku-4-5-20251001',
      balanced: 'claude-sonnet-4-6',
      capable:  'claude-opus-4-7',
    },
  },
  {
    id: 'github-copilot',
    label: 'GitHub Copilot',
    provider: 'github-copilot',
    apiKeyEnvVar: 'COPILOT_GITHUB_TOKEN',
    models: {
      fast:     COPILOT_TIER_OPTIONS.fast[0].id,
      balanced: COPILOT_TIER_OPTIONS.balanced[0].id,
      capable:  COPILOT_TIER_OPTIONS.capable[0].id,
    },
  },
  {
    id: 'swa-proxy',
    label: 'SWA Proxy (COLIN)',
    provider: 'swa-proxy',
    apiKeyEnvVar: 'MODEL_ROUTER_API_KEY',
    models: {
      fast:     'anthropic-elevate/haiku',
      balanced: 'anthropic-elevate/sonnet',
      capable:  'anthropic-elevate/opus',
    },
  },
];

/**
 * Module-level singleton tracking the currently active endpoint.
 *
 * This design assumes a single active endpoint for the entire application
 * (e.g. one browser tab / session). If we ever need to support multiple
 * concurrent endpoint configurations (for tests or different app sections),
 * this module should be refactored to avoid shared global state.
 */

/** Maps env var values to endpoint IDs. */
const ENDPOINT_ID_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  copilot: 'github-copilot',
  'swa-proxy': 'swa-proxy',
};

const VALID_ENDPOINTS = ['anthropic', 'copilot', 'swa-proxy'] as const;
type ModelEndpointValue = typeof VALID_ENDPOINTS[number];

const DEFAULT_ENDPOINT: ModelEndpointValue = 'copilot';
const raw = process.env.REACT_APP_MODEL_ENDPOINT || DEFAULT_ENDPOINT;

/** Read-only env-var-driven endpoint choice, exported for UI conditionals. */
export const MODEL_ENDPOINT: ModelEndpointValue =
  (VALID_ENDPOINTS as readonly string[]).includes(raw)
    ? (raw as ModelEndpointValue)
    : (() => {
        console.warn(`[endpointConfig] Unknown REACT_APP_MODEL_ENDPOINT="${raw}", falling back to ${DEFAULT_ENDPOINT}`);
        return DEFAULT_ENDPOINT;
      })();

let _activeId = ENDPOINT_ID_MAP[MODEL_ENDPOINT];

/**
 * Runtime overrides for tier → model mappings. Used by the settings UI
 * to let users pick a specific model per tier (e.g. GPT-5 instead of
 * Claude Sonnet for the balanced tier when using GitHub Copilot).
 */
let _tierOverrides: Partial<Record<ModelTier, string>> = {};

export function getActiveEndpoint(): EndpointDefinition {
  const endpoint = ENDPOINTS.find(e => e.id === _activeId);
  if (!endpoint) {
    throw new Error(`Unknown endpoint ID: ${_activeId}`);
  }

  // Apply runtime tier overrides if any
  if (Object.keys(_tierOverrides).length > 0) {
    return {
      ...endpoint,
      models: { ...endpoint.models, ..._tierOverrides },
    };
  }
  return endpoint;
}

export function setActiveEndpointId(id: string): void {
  if (!ENDPOINTS.find(e => e.id === id)) {
    throw new Error(`Unknown endpoint ID: ${id}`);
  }
  _activeId = id;
}

/** Set a runtime model override for a specific tier. */
export function setTierOverride(tier: ModelTier, modelId: string): void {
  _tierOverrides[tier] = modelId;
}

/** Clear all runtime tier overrides (e.g. when switching back to Anthropic). */
export function clearTierOverrides(): void {
  _tierOverrides = {};
}
