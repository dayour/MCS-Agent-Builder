/**
 * Shared avatar utilities — initials, color assignment, and the centralised
 * list of mock personas used across the prototype.
 *
 * Consumers: DWContentTab, VersionHistorySheet (and any future component
 * that needs to render a person avatar from a display name).
 */

export const AVATAR_COLORS = [
  'bg-[#0078D4]', 'bg-[#8764B8]', 'bg-[#038387]',
  'bg-[#B4009E]', 'bg-[#E74856]', 'bg-[#498205]',
];

export function initials(name: string): string {
  return name === 'You'
    ? 'Y'
    : name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Fake personas used throughout the prototype for realistic mock data. */
export const MOCK_PERSONAS = [
  'Avery Fuller',
  'Lydia Barnes',
  'Marcus Webb',
  'Sophie Laurent',
  'James Okafor',
  'Priya Nair',
  'Marco Rossi',
  'Riley Chen',
];
