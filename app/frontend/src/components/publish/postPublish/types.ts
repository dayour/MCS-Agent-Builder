/**
 * Post-publish channel configuration types.
 *
 * Defines the different integration tiers and what configuration
 * each channel requires from the maker after publishing.
 */

// ── Integration tier ────────────────────────────────────────────────────────

export type ChannelTier =
  | 'first-party'        // Full MS integration — share + redirect
  | 'demo'               // URL link sharing
  | 'third-party-known'  // Platform-specific config (callback URL, QR code, etc.)
  | 'third-party-token'  // We supply a token endpoint; they integrate it
  | 'third-party-sdk'    // We supply a connection string for their app code
  | 'third-party-bot'    // Azure Bot Framework — Bot ID + App ID + docs link
  ;

// ── Post-publish action types ───────────────────────────────────────────────

export interface ShareAction {
  type: 'share';
  label: string;
}

export interface NavigateAction {
  type: 'navigate';
  label: string;
  /** URL or deep-link template. Use `{{agentId}}` / `{{siteName}}` for interpolation. */
  urlTemplate: string;
}

export interface CopyValueAction {
  type: 'copy-value';
  label: string;
  /** Key shown to the maker (e.g. "Callback URL", "Verify token") */
  fieldLabel: string;
  /** Value template — interpolated at runtime */
  valueTemplate: string;
}

export interface ViewQrAction {
  type: 'view-qr';
  label: string;
}

export interface ExternalDocsAction {
  type: 'external-docs';
  label: string;
  /** Link to setup instructions */
  docsUrl: string;
}

export type PostPublishAction =
  | ShareAction
  | NavigateAction
  | CopyValueAction
  | ViewQrAction
  | ExternalDocsAction
  ;

// ── Channel config entry ────────────────────────────────────────────────────

export interface PostPublishChannelConfig {
  /** Channel key — matches the `channel` field on AgentConfig */
  channelKey: string;
  /** Human-readable channel name */
  displayName: string;
  /** Integration tier */
  tier: ChannelTier;
  /** Ordered list of post-publish actions the maker sees */
  actions: PostPublishAction[];
  /** Prompt guidance for the LLM — describes what the maker should do next */
  guidance: string;
}
