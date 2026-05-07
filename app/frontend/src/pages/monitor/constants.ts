// ─── Consolidated Color Palette ──────────────────────────────────────────────
// CSS variable references for theme-aware colors; raw hex only for chart/score
// consumers that need computed values. Token source: index.css :root / .dark
export const COLORS = {
  // Neutral text — theme-aware via CSS variables
  textPrimary: 'hsl(var(--text-primary))',
  textSecondary: 'hsl(var(--text-secondary))',
  textTertiary: 'hsl(var(--text-tertiary))',
  textDisabled: 'hsl(var(--text-disabled))',
  textSubtle: 'hsl(var(--text-tertiary))',
  fg2: 'hsl(var(--text-secondary))',
  fg3: 'hsl(var(--text-disabled))',
  fgSubtle: 'hsl(var(--text-disabled))',

  // Neutral backgrounds — theme-aware
  bg2: 'hsl(var(--surface-secondary))',
  bg3: 'hsl(var(--surface-tertiary))',
  bg4: 'hsl(var(--surface-quaternary))',
  bgNav: 'hsl(var(--nav-background))',

  // Strokes / borders — theme-aware
  border: 'hsl(var(--stroke-default))',
  strokeLight: 'hsl(var(--stroke-light))',
  strokeSubtle: 'hsl(var(--stroke-subtle))',

  // Subtle backgrounds
  bgGridHeader: 'hsl(var(--surface-secondary))',

  // Status text — theme-aware
  successText: 'hsl(var(--status-success))',
  dangerText: 'hsl(var(--status-error))',

  // Status — theme-aware
  success: 'hsl(var(--status-success))',
  warning: 'hsl(var(--status-warning))',
  danger: 'hsl(var(--destructive))',
  dangerRed: 'hsl(var(--destructive))',

  // Score bands — raw hex (consumed by chart libraries for computed colors)
  scoreGreen: '#107c10',
  scoreLightGreen: '#498205',
  scoreYellow: '#8a7000',
  scoreOrange: '#ca5010',

  // Chart series palette — raw hex (chart libraries need actual values)
  chartBlue: '#85A8F8',
  chartPink: '#E8A0C8',
  chartGreen: '#6DC4A0',
  chartOrange: '#F4A470',
  chartPurple: '#A890D0',
  chartLavender: '#A8AEF8',
  chartRed: '#F09090',
  chartGrey: '#bdbdbd',
  chartTeal: '#7CC0E0',
  chartMagenta: '#E959A1',
  chartViolet: '#7B61FF',

  // Brand / accent — theme-aware
  brand: 'hsl(var(--primary))',
  brandLight: 'hsl(var(--brand-background))',
  brandText: 'hsl(var(--brand-700))',
  brandHover: 'hsl(var(--brand-background-hover))',
  brandAccent: '#9373E8',

  // Microsoft product
  msBlue: '#0078d4',

  white: 'hsl(var(--background))',

  // Status badge backgrounds — opacity variants
  successBg: 'hsl(var(--status-success) / 0.1)',
  warningBg: 'hsl(var(--status-warning) / 0.1)',
  dangerBg: 'hsl(var(--destructive) / 0.1)',

  // Status badge backgrounds — lighter variant for panels
  successBgSubtle: 'hsl(var(--status-success) / 0.08)',
  dangerBgSubtle: 'hsl(var(--destructive) / 0.08)',
  warningBgSubtle: 'hsl(var(--status-warning) / 0.08)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.3)',
  shadow: 'rgba(0, 0, 0, 0.12)',
} as const

// ─── Shared CSS class strings ────────────────────────────────────────────────
// Reusable className fragments to avoid repetition across components.
export const CLS = {
  // Card container
  card: 'bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--stroke-default))]',
  cardCompact: 'bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--stroke-default))] p-2.5 px-3.5 overflow-visible',
  // Action button (outline pill)
  actionBtn: 'inline-flex items-center gap-1 h-6 px-2.5 rounded-md border border-[hsl(var(--stroke-default))] bg-[hsl(var(--card))] text-xs text-[hsl(var(--text-primary))] cursor-pointer hover:bg-[hsl(var(--secondary-hover))] transition-colors',
  // Ghost button (no border)
  ghostBtn: 'inline-flex items-center gap-1 h-6 px-2 rounded-md bg-transparent border-none text-xs text-[hsl(var(--text-secondary))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors',
  // Page wrapper
  pageRoot: 'flex-1 overflow-y-auto min-w-0',
  pageInner: 'px-4 py-0 pb-2.5 box-border',
} as const

// ─── Category Badge Colors ───────────────────────────────────────────────────
export interface CategoryColor {
  bg: string
  text: string
}

export interface CategoryColorWithBorder extends CategoryColor {
  border: string
}

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  'HR': { bg: '#EDEEF8', text: '#7078C8' },
  'Policy': { bg: '#FCEEF3', text: '#C87CA0' },
  'Remote Work': { bg: '#FFF4EA', text: '#C89868' },
  'Compliance': { bg: '#E8F4F4', text: '#58A8B0' },
  'Travel': { bg: '#F0ECF6', text: '#9880C0' },
  'Finance': { bg: '#EAF2FC', text: '#6898D0' },
  'Management': { bg: '#FBF0ED', text: '#C08070' },
}

const FALLBACK_COLORS: CategoryColor[] = [
  { bg: '#EDEEF8', text: '#7078C8' },
  { bg: '#FCEEF3', text: '#C87CA0' },
  { bg: '#FFF4EA', text: '#C89868' },
  { bg: '#E8F4F4', text: '#58A8B0' },
  { bg: '#F0ECF6', text: '#9880C0' },
  { bg: '#F3EDF5', text: '#A880B8' },
  { bg: '#EAF2FC', text: '#6898D0' },
  { bg: '#FBF0ED', text: '#C08070' },
]

const darkenColor = (hex: string, amount: number = 0.15): string => {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xFF) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xFF) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xFF) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export const getCategoryColor = (name: string): CategoryColorWithBorder => {
  const base = CATEGORY_COLORS[name] || (() => {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = ((hash << 7) - hash + name.charCodeAt(i)) | 0
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
  })()
  return { ...base, border: darkenColor(base.bg, 0.12) }
}

// ─── Shared Chart Defaults ───────────────────────────────────────────────────
export const CHART_DEFAULTS = {
  tooltip: {
    outside: true,
    style: { zIndex: 9999 },
    shadow: { color: 'rgba(0,0,0,0.08)', offsetX: 0, offsetY: 2, width: 6 },
  },
  animation: { duration: 500 },
} as const
