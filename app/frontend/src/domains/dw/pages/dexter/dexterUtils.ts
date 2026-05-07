/** Shared constants and helpers for Dexter admin pages. */

export const MODEL_OPTIONS = [
  { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
];

export const PROVIDER_OPTIONS = [
  { label: 'Claude', value: 'claude' },
  { label: 'Azure OpenAI', value: 'azure-openai' },
];

export const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Idle', value: 'idle' },
  { label: 'Offline', value: 'offline' },
];

/** Map a lifecycle/status string to a CopilotBadge color. */
export function badgeColor(value: string | null): 'success' | 'informative' | 'danger' | 'warning' | 'subtle' {
  if (!value) return 'subtle';
  const v = value.toLowerCase();
  if (v === 'ready' || v === 'active' || v === 'succeeded') return 'success';
  if (v === 'provisioning' || v === 'creating') return 'informative';
  if (v === 'failed' || v === 'error') return 'danger';
  if (v === 'offline') return 'warning';
  return 'subtle';
}

/** Map a task/signal status to a Tailwind text color class. */
export function statusColor(value: string | null): string {
  if (!value) return 'text-neutral-500';
  const v = value.toLowerCase();
  if (v === 'completed' || v === 'succeeded' || v === 'sent' || v === 'delivered') return 'text-green-600';
  if (v === 'running' || v === 'in_progress' || v === 'pending' || v === 'scheduled') return 'text-blue-500';
  if (v === 'failed' || v === 'error') return 'text-red-500';
  if (v === 'cancelled' || v === 'canceled') return 'text-neutral-500';
  return 'text-neutral-600';
}
