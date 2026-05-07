import React from 'react'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowUp16Regular,
  ArrowDown16Regular,
  ChevronLeft16Regular,
  ChevronLeft24Regular,
  ChevronRight16Regular,
  ChevronDown16Regular,
  Checkmark20Regular,
  Info16Regular,
  Sparkle20Regular,
} from '@fluentui/react-icons'
import { COLORS, CLS } from '../constants'
import { CopilotButton } from '../../../components/ui/CopilotButton'

// ─── KPI Item ─────────────────────────────────────────────────────────────────
// Reusable KPI display with value, optional trend indicator, and label.
// compact: tighter sizing for side-panel cards
interface KPIItemProps {
  value: string | number
  trend?: string
  trendUp?: boolean
  label: string
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}

export function KPIItem({ value, trend, trendUp, label, compact, className, style }: KPIItemProps) {
  return (
    <div className={className} style={{ overflow: 'hidden', ...style }}>
      <div className="flex items-baseline gap-1 whitespace-nowrap" style={{ marginBottom: '2px' }}>
        <span className={`${compact ? 'text-sm' : 'text-lg'} font-normal text-gray-900`}>{value}</span>
        {trend && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {trendUp
              ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
              : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />}
            <span className="text-[11px] font-semibold" style={{ color: trendUp ? COLORS.successText : COLORS.dangerText }}>{trend}</span>
          </div>
        )}
      </div>
      <span className={`block whitespace-nowrap overflow-hidden text-ellipsis ${compact ? 'text-[11px]' : 'text-xs'} text-gray-500`} style={{ color: COLORS.textTertiary }}>{label}</span>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
// Reusable section header with title, optional tooltip, and optional action area.
interface SectionHeaderProps {
  title: string
  tooltip?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function SectionHeader({ title, tooltip, children, style }: SectionHeaderProps) {
  return (
    <div className="flex justify-between items-center" style={style}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-gray-500">{title}</span>
        {tooltip && (
          <Tooltip content={tooltip} relationship="description">
            <Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} />
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Chart Card ──────────────────────────────────────────────────────────────
// Bordered card with a header row (title + tooltip + optional action button) + content.
interface ChartCardProps {
  title: string
  tooltip?: string
  actionLabel?: string
  onAction?: () => void
  children?: React.ReactNode
  style?: React.CSSProperties
  headerStyle?: React.CSSProperties
}

export function ChartCard({ title, tooltip, actionLabel, onAction, children, style, headerStyle }: ChartCardProps) {
  return (
    <div className={CLS.card} style={style}>
      <div className="flex items-center justify-between p-3 pb-0" style={headerStyle}>
        <SectionHeader title={title} tooltip={tooltip} />
        {actionLabel && (
          <CopilotButton variant="outline" size="xs" onClick={onAction}>{actionLabel}</CopilotButton>
        )}
      </div>
      <div className="p-3 pt-0">
        {children}
      </div>
    </div>
  )
}

// ─── AI Summary Card ─────────────────────────────────────────────────────────
// Expandable AI insight card with Sparkle icon, skeleton loading, and toggle.
interface AISummaryCardProps {
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  showSkeleton?: boolean
  collapsedText?: string
  children?: React.ReactNode
}

export function AISummaryCard({ expanded, setExpanded, showSkeleton, collapsedText, children }: AISummaryCardProps) {
  return (
    <div className="relative mb-2.5" style={{ marginBottom: '10px' }}>
      <div className={CLS.card} style={{ minHeight: expanded ? '140px' : 'auto', padding: expanded ? undefined : '6px 14px' }}>
        {!expanded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkle20Regular style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span className="text-[11px] text-gray-500" style={{ flex: 1 }}>{collapsedText}</span>
            <CopilotButton variant="ghost" size="xs" onClick={() => setExpanded(true)} style={{ flexShrink: 0 }}>View more</CopilotButton>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4">
              <Sparkle20Regular className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {showSkeleton ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="animate-pulse bg-gray-200 rounded" style={{ width: '90%', height: '14px' }} />
                    <div className="animate-pulse bg-gray-200 rounded" style={{ width: '85%', height: '14px' }} />
                  </div>
                ) : (
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-600">{children}</ul>
                )}
              </div>
            </div>
            <CopilotButton variant="ghost" size="xs" onClick={() => setExpanded(false)}>View less</CopilotButton>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Detail Page Header ──────────────────────────────────────────────────────
// Back button + page title + optional right-side actions. Used in all drill-down pages.
interface DetailPageHeaderProps {
  title: string
  onBack: () => void
  children?: React.ReactNode
}

export function DetailPageHeader({ title, onBack, children }: DetailPageHeaderProps) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
      <CopilotButton variant="icon-subtle" size="xs" onClick={onBack} aria-label="Go back">
        <ChevronLeft24Regular />
      </CopilotButton>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Overview KPI Card ───────────────────────────────────────────────────────
// Card that displays a row of KPI items with a section header.
// kpis: [{ value, label, trend: { pct, up } }]
interface KPIData {
  value: string | number
  label: string
  trend?: { pct: string; up: boolean }
}

interface OverviewKPICardProps {
  title: string
  tooltip?: string
  kpis?: KPIData[]
  actionLabel?: string
  onAction?: () => void
  rows?: KPIData[][]
  children?: React.ReactNode
}

export function OverviewKPICard({ title, tooltip, kpis, actionLabel, onAction, rows, children }: OverviewKPICardProps) {
  return (
    <div className={CLS.cardCompact}>
      <SectionHeader title={title} tooltip={tooltip} style={{ marginBottom: '6px' }}>
        {actionLabel && <CopilotButton variant="outline" size="xs" onClick={onAction}>{actionLabel}</CopilotButton>}
        {children}
      </SectionHeader>
      {rows ? rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: i < rows.length - 1 ? '8px' : 0 }}>
          {row.map(kpi => <KPIItem key={kpi.label} value={kpi.value} trend={kpi.trend?.pct} trendUp={kpi.trend?.up} label={kpi.label} style={{ flex: 1 }} />)}
        </div>
      )) : kpis && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
          {kpis.map(kpi => <KPIItem key={kpi.label} value={kpi.value} trend={kpi.trend?.pct} trendUp={kpi.trend?.up} label={kpi.label} style={{ flex: 1 }} />)}
        </div>
      )}
    </div>
  )
}

// ─── Pill Switcher ────────────────────────────────────────────────────────────
// Reusable segmented control / pill toggle.
// options: [{ key: 'tools', label: 'Tools' }, ...]
interface PillSwitcherProps {
  options: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
  compact?: boolean
}

export function PillSwitcher({ options, value, onChange }: PillSwitcherProps) {
  return (
    <div className="inline-flex bg-gray-100 rounded-full" style={{ padding: '2px' }}>
      {options.map(({ key, label }) => (
        <CopilotButton
          key={key}
          variant="ghost"
          size="xs"
          onClick={() => onChange(key)}
          className={`
            rounded-full text-[11px]
            ${value === key
              ? 'font-semibold text-gray-900 bg-white shadow-sm'
              : 'font-normal text-gray-600 bg-transparent'}
          `}
          style={{ height: '22px', padding: '0 10px', minWidth: '60px' }}
        >
          {label}
        </CopilotButton>
      ))}
    </div>
  )
}

// ─── Time Range Menu ──────────────────────────────────────────────────────────
// Pill-style time range selector with checkmark selection.
interface TimeRangeMenuProps {
  timeRange: string
  setTimeRange: (range: string) => void
  onCustomClick?: () => void
}

export function TimeRangeMenu({ timeRange, setTimeRange, onCustomClick }: TimeRangeMenuProps) {
  const label = timeRange === '7days' ? 'Last 7 days' :
                timeRange === '15days' ? 'Last 14 days' :
                timeRange === '4weeks' ? 'Last 4 weeks' :
                'Custom time range'
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <button
          type="button"
          className="inline-flex items-center gap-1 border border-gray-200 rounded-full bg-white text-gray-900 text-[11px] font-normal cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-colors"
          style={{ height: '24px', padding: '0 10px' }}
        >
          {label}
          <ChevronDown16Regular className="w-3 h-3" />
        </button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => setTimeRange('7days')} icon={timeRange === '7days' ? <Checkmark20Regular /> : <div style={{ width: '20px' }} />}>Last 7 days</MenuItem>
          <MenuItem onClick={() => setTimeRange('15days')} icon={timeRange === '15days' ? <Checkmark20Regular /> : <div style={{ width: '20px' }} />}>Last 14 days</MenuItem>
          <MenuItem onClick={() => setTimeRange('4weeks')} icon={timeRange === '4weeks' ? <Checkmark20Regular /> : <div style={{ width: '20px' }} />}>Last 4 weeks</MenuItem>
          <MenuItem onClick={() => onCustomClick ? onCustomClick() : setTimeRange('custom')} icon={timeRange === 'custom' ? <Checkmark20Regular /> : <div style={{ width: '20px' }} />}>Custom time range</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────
// Renders a colored badge based on a variant string.
// variant: 'success' | 'warning' | 'danger'
const VARIANT_STYLES = {
  success: 'bg-[hsl(var(--status-success)/0.15)] text-[hsl(var(--status-success))]',
  warning: 'bg-[#FFF4CE] text-[#7A4100]',
  danger:  'bg-[hsl(var(--status-error)/0.1)] text-[hsl(var(--status-error))]',
}

interface StatusBadgeProps {
  variant: 'success' | 'warning' | 'danger'
  children?: React.ReactNode
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const cls = VARIANT_STYLES[variant] || VARIANT_STYLES.success
  return (
    <span className={`inline-flex items-center h-5 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap ${cls}`}>
      {children}
    </span>
  )
}

// ─── Quality Badge ───────────────────────────────────────────────────────────
// Renders a percentage-based quality indicator (Good / Average / Poor).
// Returns em-dash when value is null.
interface QualityBadgeProps {
  value: number | null | undefined
}

export function QualityBadge({ value }: QualityBadgeProps) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] text-gray-400">—</span>
  }
  const label = value >= 70 ? 'Good' : value >= 50 ? 'Average' : 'Poor'
  const variant = value >= 70 ? 'success' : value >= 50 ? 'warning' : 'danger'
  const cls = VARIANT_STYLES[variant]
  return (
    <span className={`inline-flex items-center h-5 px-2.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Percentage Badge ────────────────────────────────────────────────────────
// Like QualityBadge but displays a custom label (e.g. "85%") with
// configurable thresholds. Used by Grids for response quality / success rate.
interface PercentageBadgeProps {
  value: number
  label?: string | number
  highThreshold?: number
  midThreshold?: number
}

export function PercentageBadge({ value, label, highThreshold = 70, midThreshold = 50 }: PercentageBadgeProps) {
  const variant = value >= highThreshold ? 'success' : value >= midThreshold ? 'warning' : 'danger'
  const cls = VARIANT_STYLES[variant]
  return (
    <span className={`inline-flex items-center h-5 px-2.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label ?? value}
    </span>
  )
}

// ─── Pill Filter ─────────────────────────────────────────────────────────────
// Pill-style filter with visible selected value and dropdown.
// Matches Copilot Studio filter pattern: "Label: Value ▾"
interface FilterMenuProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label: string
  defaultValue?: string
}

export function FilterMenu({ options, value, onChange, label, defaultValue = 'all' }: FilterMenuProps) {
  const isActive = value !== defaultValue
  const selectedLabel = options.find(o => o.value === value)?.label || value
  const displayText = `${label}: ${selectedLabel}`
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <button
          type="button"
          className={`
            inline-flex items-center gap-1 border rounded-full text-[11px]
            font-[inherit] cursor-pointer transition-all duration-150 whitespace-nowrap
            ${isActive
              ? 'bg-gray-100 border-gray-300 font-semibold text-gray-900'
              : 'bg-white border-gray-200 font-normal text-gray-900 hover:bg-gray-50'}
          `}
          style={{ height: '24px', padding: '0 10px' }}
        >
          {displayText}
          <ChevronDown16Regular className="w-3 h-3" />
        </button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {options.map(opt => (
            <MenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              icon={value === opt.value ? <Checkmark20Regular /> : <div style={{ width: '20px' }} />}
            >
              {opt.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

// ─── Pagination ──────────────────────────────────────────────────────────────
// Reusable pagination footer with smart page number display.
interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, totalItems, startIndex, endIndex, onPageChange }: PaginationProps) {
  return (
    <div className="flex justify-between items-center px-3 h-9 bg-white border-t border-gray-100">
      <span className="text-[11px] text-gray-400">
        {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <CopilotButton
          variant="icon-subtle"
          size="xs"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft16Regular className="w-4 h-4" />
        </CopilotButton>
        <div className="flex items-center gap-2" role="navigation" aria-label="Pagination">
          {[...Array(totalPages)].map((_, index) => {
            const pageNum = index + 1
            if (totalPages > 7) {
              if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                return (
                  <CopilotButton
                    key={pageNum}
                    variant="ghost"
                    size="xs"
                    className={`text-[11px] min-w-0 px-1 ${currentPage === pageNum ? 'font-semibold text-gray-900' : 'text-gray-400'}`}
                    onClick={() => onPageChange(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </CopilotButton>
                )
              }
              if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return <span key={pageNum} className="text-[11px] text-gray-400" aria-hidden="true">...</span>
              }
              return null
            }
            return (
              <CopilotButton
                key={pageNum}
                variant="ghost"
                size="xs"
                className={`text-[11px] min-w-0 px-1 ${currentPage === pageNum ? 'font-semibold text-gray-900' : 'text-gray-400'}`}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </CopilotButton>
            )
          })}
        </div>
        <CopilotButton
          variant="icon-subtle"
          size="xs"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight16Regular className="w-4 h-4" />
        </CopilotButton>
      </div>
    </div>
  )
}
