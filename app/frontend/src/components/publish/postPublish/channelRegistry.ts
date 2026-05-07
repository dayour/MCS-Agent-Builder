/**
 * Post-publish channel configuration registry.
 *
 * Maps each channel key to its tier, display name, and the actions
 * a maker needs to complete after publishing.
 */

import type { PostPublishChannelConfig } from './types';

// ── 1st-party apps (full integration) ───────────────────────────────────────

const m365Copilot: PostPublishChannelConfig = {
  channelKey: 'm365',
  displayName: 'Microsoft 365 Copilot',
  tier: 'first-party',
  guidance: 'Share the agent to start driving adoption.',
  actions: [
    { type: 'share', label: 'Share agent' },
    { type: 'navigate', label: 'Go to Microsoft 365 Copilot', urlTemplate: 'https://copilot.microsoft.com' },
  ],
};

const teams: PostPublishChannelConfig = {
  channelKey: 'teams',
  displayName: 'Microsoft Teams',
  tier: 'first-party',
  guidance: 'Share the agent to start driving adoption.',
  actions: [
    { type: 'share', label: 'Share agent' },
    { type: 'navigate', label: 'Go to Microsoft Teams', urlTemplate: 'https://teams.microsoft.com' },
  ],
};

const sharepoint: PostPublishChannelConfig = {
  channelKey: 'sharepoint',
  displayName: 'SharePoint',
  tier: 'first-party',
  guidance: 'Share the agent to start driving adoption.',
  actions: [
    { type: 'share', label: 'Share agent' },
    { type: 'navigate', label: 'Go to SharePoint site', urlTemplate: '{{siteUrl}}' },
  ],
};

// ── Demo ────────────────────────────────────────────────────────────────────

const demoWebsite: PostPublishChannelConfig = {
  channelKey: 'demo-website',
  displayName: 'Demo website',
  tier: 'demo',
  guidance: 'Share the URL with your team to see your agent in action.',
  actions: [
    { type: 'copy-value', label: 'Copy URL', fieldLabel: 'Demo URL', valueTemplate: '{{demoUrl}}' },
    { type: 'share', label: 'Share URL link' },
  ],
};

// ── 3rd-party apps (known integration) ──────────────────────────────────────

const facebook: PostPublishChannelConfig = {
  channelKey: 'facebook',
  displayName: 'Facebook',
  tier: 'third-party-known',
  guidance: 'Copy the Callback URL and Verify Token into Facebook to complete setup.',
  actions: [
    { type: 'copy-value', label: 'Copy Callback URL', fieldLabel: 'Callback URL', valueTemplate: '{{callbackUrl}}' },
    { type: 'copy-value', label: 'Copy Verify Token', fieldLabel: 'Verify token', valueTemplate: '{{verifyToken}}' },
  ],
};

const whatsapp: PostPublishChannelConfig = {
  channelKey: 'whatsapp',
  displayName: 'WhatsApp',
  tier: 'third-party-known',
  guidance: 'Scan the QR code to view your agent in WhatsApp.',
  actions: [
    { type: 'view-qr', label: 'View QR code' },
  ],
};

// ── 3rd-party apps (token endpoint) ─────────────────────────────────────────

function tokenEndpointChannel(channelKey: string, displayName: string): PostPublishChannelConfig {
  return {
    channelKey,
    displayName,
    tier: 'third-party-token',
    guidance: 'Copy the token endpoint to connect your agent to the app.',
    actions: [
      { type: 'copy-value', label: 'Copy token endpoint', fieldLabel: 'Token endpoint', valueTemplate: '{{tokenEndpoint}}' },
    ],
  };
}

const slack = tokenEndpointChannel('slack', 'Slack');
const telegram = tokenEndpointChannel('telegram', 'Telegram');
const twilio = tokenEndpointChannel('twilio', 'Twilio');
const line = tokenEndpointChannel('line', 'Line');
const groupme = tokenEndpointChannel('groupme', 'GroupMe');
const directLineSpeech = tokenEndpointChannel('direct-line-speech', 'Direct Line Speech');
const email = tokenEndpointChannel('email', 'Email');

// ── 3rd-party apps (MS Agent SDK — connection string) ───────────────────────

function sdkChannel(channelKey: string, displayName: string): PostPublishChannelConfig {
  return {
    channelKey,
    displayName,
    tier: 'third-party-sdk',
    guidance: 'Copy the connection string and paste it into your app\'s code.',
    actions: [
      { type: 'copy-value', label: 'Copy connection string', fieldLabel: 'Connection string', valueTemplate: '{{connectionString}}' },
    ],
  };
}

const webApp = sdkChannel('web-app', 'Web app');
const nativeApp = sdkChannel('native-app', 'Native app');
const mcpClient = sdkChannel('mcp-client', 'MCP client');

// ── External customer engagement (Azure Bot Framework) ──────────────────────

function botFrameworkChannel(channelKey: string, displayName: string): PostPublishChannelConfig {
  return {
    channelKey,
    displayName,
    tier: 'third-party-bot',
    guidance: 'Copy the Bot ID and App ID to create a connection to your agent.',
    actions: [
      { type: 'copy-value', label: 'Copy Bot ID', fieldLabel: 'Bot ID', valueTemplate: '{{botId}}' },
      { type: 'copy-value', label: 'Copy App ID', fieldLabel: 'App ID', valueTemplate: '{{appId}}' },
      { type: 'external-docs', label: 'View setup instructions', docsUrl: '{{docsUrl}}' },
    ],
  };
}

const genesys = botFrameworkChannel('genesys', 'Genesys');
const liveperson = botFrameworkChannel('liveperson', 'LivePerson');
const salesforce = botFrameworkChannel('salesforce', 'Salesforce');
const servicenow = botFrameworkChannel('servicenow', 'ServiceNow');

// ── Registry ────────────────────────────────────────────────────────────────

const ALL_CHANNELS: PostPublishChannelConfig[] = [
  // 1st-party
  m365Copilot, teams, sharepoint,
  // Demo
  demoWebsite,
  // 3rd-party known
  facebook, whatsapp,
  // 3rd-party token endpoint
  slack, telegram, twilio, line, groupme, directLineSpeech, email,
  // MS Agent SDK
  webApp, nativeApp, mcpClient,
  // Azure Bot Framework
  genesys, liveperson, salesforce, servicenow,
];

const channelMap = new Map<string, PostPublishChannelConfig>(
  ALL_CHANNELS.map(c => [c.channelKey, c])
);

/**
 * Maps display names and common variants to registry keys.
 * Keys are lowercase for case-insensitive lookup.
 */
const channelAliases = new Map<string, string>([
  // 1st-party
  ['microsoft 365', 'm365'],
  ['microsoft 365 copilot', 'm365'],
  ['microsoft teams', 'teams'],
  ['teams & m365 copilot', 'm365'],
  // Demo
  ['demo website', 'demo-website'],
  ['website', 'demo-website'],
  ['web', 'demo-website'],
  ['webchat', 'demo-website'],
  // 3rd-party known
  ['whatsapp', 'whatsapp'],
  // 3rd-party token endpoint
  ['direct line speech', 'direct-line-speech'],
  ['outlook', 'email'],
  // MS Agent SDK
  ['web app', 'web-app'],
  ['native app', 'native-app'],
  ['mcp client', 'mcp-client'],
]);

/**
 * Look up a channel's post-publish config by its key or display name.
 * Accepts registry keys (e.g. `'teams'`), display names (e.g. `'Microsoft Teams'`),
 * and common variants. Case-insensitive.
 */
export function getPostPublishConfig(channelKey: string): PostPublishChannelConfig | undefined {
  const lower = channelKey.toLowerCase();
  return channelMap.get(lower) ?? channelMap.get(channelAliases.get(lower) ?? '');
}

/**
 * Returns a copy of all registered channel configs.
 */
export function getAllPostPublishConfigs(): readonly PostPublishChannelConfig[] {
  return [...ALL_CHANNELS];
}
