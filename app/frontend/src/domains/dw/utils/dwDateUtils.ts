// ── Shared DW date utilities ──────────────────────────────────────────────────
// Single source of truth for the demo reference date used across all DW tabs.
// All date-formatting functions that previously lived in DWContentTab,
// DWMessagesTab, and DWOverviewTab are consolidated here.

export const DW_REFERENCE_DATE = new Date('2026-03-25T12:00:00');

function daysDiff(iso: string): number {
  return Math.floor((DW_REFERENCE_DATE.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** "Today at 2:00 PM", "Yesterday at 2:00 PM", "Wed at 2:00 PM", "Mar 15" */
export function formatDwDate(iso: string): string {
  const date = new Date(iso);
  const diff = daysDiff(iso);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diff === 0) return `Today at ${timeStr}`;
  if (diff === 1) return `Yesterday at ${timeStr}`;
  if (diff < 7) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} at ${timeStr}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Today", "Yesterday", "Wed", "Mar 15" — no time component */
export function formatDwActivityDate(iso: string): string {
  const date = new Date(iso);
  const diff = daysDiff(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Task date — today/yesterday/tomorrow with time; actual date + time otherwise */
export function formatTaskDate(iso: string, status?: string): string {
  const date = new Date(iso);
  const diff = daysDiff(iso);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (diff === 0)  return `Today at ${timeStr}`;
  if (diff === 1)  return `Yesterday at ${timeStr}`;
  if (diff === -1) return `Tomorrow at ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}

/** Task date without time — for compact table rows */
export function formatTaskDateShort(iso: string): string {
  const date = new Date(iso);
  const diff = daysDiff(iso);

  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
