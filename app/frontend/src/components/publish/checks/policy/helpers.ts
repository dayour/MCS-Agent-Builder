import { CHANNEL_DISPLAY_NAMES } from '../../../../utils/buildPageUtils';

export function isInsecureEndpoint(endpoint: string): boolean {
  return /^http:\/\//i.test(endpoint.trim());
}

export function formatChannelName(channelKey: string): string {
  const normalized = channelKey.toLowerCase() === 'm365' ? 'microsoft 365' : channelKey.toLowerCase();
  return CHANNEL_DISPLAY_NAMES[normalized] ?? channelKey;
}