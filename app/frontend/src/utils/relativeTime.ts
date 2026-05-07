import { useState, useEffect } from 'react';

/**
 * Converts a date to a human-friendly relative time string.
 *
 * 0–30s  → "Just now"
 * 1–59m  → "X min ago"
 * 1–23h  → "X hours ago"
 * 24–48h → "Yesterday"
 * 2–6d   → "X days ago"
 * 1–3w   → "X weeks ago"
 * 1–11mo → "X months ago"
 * 1y+    → "X years ago"
 */
export function getRelativeTime(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30.44); // average days per month
  const years = Math.floor(days / 365.25);

  if (seconds <= 30) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (hours < 48) return 'Yesterday';
  if (days <= 6) return `${days} days ago`;
  if (weeks <= 3) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  if (months <= 11) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Formats a date as a full human-readable string for tooltip display.
 * Example: "Mar 24, 2026 at 3:45 PM"
 */
export function formatFullDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * React hook that returns a relative time string and keeps it fresh.
 * Re-computes every `intervalMs` (default 60 s).
 */
export function useRelativeTime(date: Date | string | number | undefined, intervalMs = 60_000): string {
  const [text, setText] = useState(() => (date ? getRelativeTime(date) : ''));

  useEffect(() => {
    if (!date) { setText(''); return; }
    setText(getRelativeTime(date));
    const id = setInterval(() => setText(getRelativeTime(date)), intervalMs);
    return () => clearInterval(id);
  }, [date, intervalMs]);

  return text;
}
