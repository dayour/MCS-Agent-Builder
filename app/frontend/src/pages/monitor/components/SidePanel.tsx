import React, { useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { Tooltip } from '@fluentui/react-components'
import { Dialog as ElevateDialog, DialogHeader as ElevateDialogHeader, DialogContent as ElevateDialogContent, DialogTitle as ElevateDialogTitle } from '../../../components/ui/Dialog'
import {
  ArrowUp16Regular,
  ArrowDown16Regular,
  Dismiss20Regular,
  ThumbLike20Regular,
  ThumbDislike20Regular,
  Info16Regular,
} from '@fluentui/react-icons'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { COLORS, CHART_DEFAULTS } from '../constants'
import { StatusBadge, PillSwitcher } from './SharedComponents'
import {
  Database20Regular,
  Globe20Filled,
  Document20Color,
  DocumentText20Color,
  ArrowExport20Regular,
  Eye20Regular,
} from '@fluentui/react-icons'
import type { Evaluation, Question, Session } from '../types'

// ─── Shared Props ───────────────────────────────────────────────────────────
interface PanelProps {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
}

interface SidePanelProps extends PanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

// ─── Generic SidePanel Wrapper ──────────────────────────────────────────────
// Renders the overlay backdrop, fixed panel shell, header with thumbs + dismiss,
// and a scrollable content area for children.
function SidePanel({ open, onClose, title, subtitle, children, headerExtra, compact }: SidePanelProps) {
  if (!open) return null
  return (
    <div className="h-full bg-white border-l border-[hsl(var(--stroke-default))] flex flex-col overflow-hidden"
      style={{ width: compact ? '320px' : '400px', minWidth: compact ? '280px' : '320px', animation: 'slideInRight 0.25s ease-out', fontSize: compact ? '11px' : undefined }}>
      {/* Panel Header */}
      <div className="flex items-start justify-between flex-shrink-0"
        style={{ padding: compact ? '12px 8px 8px 16px' : '16px 12px 12px 20px' }}>
        <div className="flex flex-col gap-0.5 flex-1">
          {typeof title === 'string' ? (
            <span className={`font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</span>
          ) : title}
          {subtitle && (
            <span className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>{subtitle}</span>
          )}
        </div>
        <div className="flex items-center flex-shrink-0">
          <CopilotButton variant="icon-subtle" size="xs" aria-label="Thumbs up">
            <ThumbLike20Regular style={compact ? { width: '16px', height: '16px' } : undefined} />
          </CopilotButton>
          <CopilotButton variant="icon-subtle" size="xs" aria-label="Thumbs down">
            <ThumbDislike20Regular style={compact ? { width: '16px', height: '16px' } : undefined} />
          </CopilotButton>
          <CopilotButton variant="icon-subtle" size="xs" aria-label="Close" onClick={onClose}>
            <Dismiss20Regular style={compact ? { width: '16px', height: '16px' } : undefined} />
          </CopilotButton>
        </div>
      </div>
      {headerExtra}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: compact ? '4px 16px 16px' : '6px 20px 20px', scrollbarWidth: 'none' }}>
        {children}
      </div>
    </div>
  )
}

// ─── 1. Active Users Panel ──────────────────────────────────────────────────
export function ActiveUsersPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Active users"
      subtitle="Unique active users by different date ranges and over time."
    >
      {/* Daily Active Users Chart */}
      <div style={{ paddingBottom: '16px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Daily active users over time
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px' }}>
          See how the number of daily active users varied over the selected period
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'areaspline',
              height: 180,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 0,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: { enabled: false },
            xAxis: {
              categories: ['Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            tooltip: {
              useHTML: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px"><span style="color:' + COLORS.chartBlue + '">●</span> Active users: <b>{point.y}</b></div>',
            },
            plotOptions: {
              areaspline: {
                fillOpacity: 0.12,
                lineWidth: 2,
                marker: {
                  enabled: true,
                  radius: 3,
                  symbol: 'circle',
                  states: {
                    hover: {
                      enabled: true,
                      radius: 5,
                      lineColor: COLORS.white,
                      lineWidth: 2,
                    },
                  },
                },
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [{
              name: 'Active users',
              data: [320, 450, 280, 680, 520, 890, 750],
              color: COLORS.chartBlue,
            }],
          }}
        />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}`, marginBottom: '16px' }} />

      {/* Monthly Active Users Chart */}
      <div>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Monthly active users over time
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px' }}>
          See how the number of monthly active users varied over the selected period
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'column',
              height: 180,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 0,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: { enabled: false },
            xAxis: {
              categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            tooltip: {
              useHTML: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px"><span style="color:' + COLORS.chartBlue + '">●</span> Active users: <b>{point.y}</b></div>',
            },
            plotOptions: {
              column: {
                color: COLORS.chartBlue,
                borderRadius: '4px',
                borderWidth: 0,
                groupPadding: 0.15,
                pointPadding: 0.05,
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [{
              name: 'Active users',
              data: [420, 580, 350, 720, 890, 650, 780],
            }],
          }}
        />
      </div>
    </SidePanel>
  )
}

// ─── 2. Billing Panel ───────────────────────────────────────────────────────
export function BillingPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Billing"
      subtitle="Overview of credit usage, billing trends, and cost distribution."
    >
      {/* Credit Limit Section */}
      <div style={{ paddingBottom: '16px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '10px' }}>
          Monthly credit limit
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span className="text-lg font-normal text-gray-900">7,500</span>
            <span className="text-xs text-gray-500">/ 10,000 credits used</span>
          </div>
          <span className="text-xs font-semibold cursor-pointer" style={{ color: 'hsl(var(--primary))' }}>Buy more</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: 'hsl(var(--stroke-default))', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: '75%', height: '100%', backgroundColor: COLORS.chartPink, borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span className="text-[10px] text-gray-400">75% used</span>
          <span className="text-[10px] text-gray-400">2,500 remaining</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}`, marginBottom: '16px' }} />

      {/* Billing Trend Chart */}
      <div style={{ paddingBottom: '16px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Billing trend over time
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px' }}>
          Monthly credit consumption over the past 6 months
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'areaspline',
              height: 170,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 0,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: { enabled: false },
            xAxis: {
              categories: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
                formatter: function(this: Highcharts.AxisLabelsFormatterContextObject) { return (this.value as number) >= 1000 ? ((this.value as number) / 1000) + 'k' : String(this.value) },
              },
            },
            tooltip: {
              useHTML: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px"><span style="color:' + COLORS.chartBlue + '">●</span> Credits used: <b>{point.y}</b></div>',
            },
            plotOptions: {
              areaspline: {
                fillOpacity: 0.12,
                lineWidth: 2,
                marker: {
                  enabled: true,
                  radius: 3,
                  symbol: 'circle',
                  states: {
                    hover: {
                      enabled: true,
                      radius: 5,
                      lineColor: COLORS.white,
                      lineWidth: 2,
                    },
                  },
                },
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [{
              name: 'Credits used',
              data: [980, 1250, 1100, 1480, 1320, 1500],
              color: COLORS.chartBlue,
            }],
          }}
        />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}`, marginBottom: '16px' }} />

      {/* Cost Distribution */}
      {(() => {
        const costItems = [
          { name: 'Messages', value: 2800, color: COLORS.chartBlue },
          { name: 'Generative answers', value: 1400, color: COLORS.chartGreen },
          { name: 'AI Builders', value: 1950, color: COLORS.chartPink },
          { name: 'Classic AI', value: 850, color: COLORS.chartOrange },
        ]
        const costTotal = costItems.reduce((sum, item) => sum + item.value, 0)
        return (
          <div>
            <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
              Cost distribution by feature
            </span>
            <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px' }}>
              Breakdown of credit usage across different features
            </span>

            {/* Stacked bar */}
            <div style={{ display: 'flex', width: '100%', height: '10px', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              {costItems.map((item, idx) => (
                <div key={idx} style={{ width: `${(item.value / costTotal) * 100}%`, height: '100%', backgroundColor: item.color }} />
              ))}
            </div>

            {/* Legend list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {costItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                    <span className="text-xs text-gray-500">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </SidePanel>
  )
}

// ─── 3. Satisfaction Panel ──────────────────────────────────────────────────
export function SatisfactionPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Satisfaction"
      subtitle="Customer satisfaction scores and trends over time."
    >
      {/* Satisfaction Over Time */}
      <div>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Satisfaction over time
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px' }}>
          Average CSAT score trend over the selected period
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'areaspline',
              height: 170,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 5,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: { enabled: false },
            xAxis: {
              categories: ['Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 1,
              max: 5,
              tickInterval: 1,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                x: -5,
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            tooltip: {
              useHTML: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px"><span style="color:' + COLORS.chartGreen + '">●</span> CSAT: <b>{point.y}</b></div>',
            },
            plotOptions: {
              areaspline: {
                fillOpacity: 0.12,
                lineWidth: 2,
                marker: {
                  enabled: true,
                  radius: 3,
                  symbol: 'circle',
                  states: {
                    hover: {
                      enabled: true,
                      radius: 5,
                      lineColor: COLORS.white,
                      lineWidth: 2,
                    },
                  },
                },
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [{
              name: 'CSAT',
              data: [3.8, 4.1, 3.9, 4.3, 4.0, 4.4, 4.2],
              color: COLORS.chartGreen,
            }],
          }}
        />
      </div>
    </SidePanel>
  )
}

// ─── 4. Sentiment Details Panel ─────────────────────────────────────────────
export function SentimentPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="text-sm font-semibold text-gray-900">
            Sentiment details
          </span>
        </div>
      }
      subtitle="The breakdown of sentiment over time and distribution."
    >
      {/* Sentiment Trend */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Sentiment trend
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: COLORS.textTertiary,
            backgroundColor: 'hsl(var(--surface-secondary))',
            padding: '0px 4px',
            borderRadius: '2px',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            lineHeight: '16px',
          }}>Preview</span>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px' }}>
          The breakdown of sentiment over time. Scores are AI generated and based on sample of all engaged sessions.
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'line',
              height: 240,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 5,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: {
              enabled: true,
              align: 'left',
              verticalAlign: 'bottom',
              layout: 'horizontal',
              itemStyle: {
                color: 'hsl(var(--text-secondary))',
                fontSize: '12px',
                fontWeight: '400',
              },
              symbolWidth: 16,
              itemDistance: 16,
            },
            xAxis: {
              categories: ['Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              max: 100,
              tickInterval: 20,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                x: -5,
                format: '{value}%',
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            tooltip: {
              useHTML: true,
              shared: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px;margin-bottom:2px"><span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y}%</b></div>',
            },
            plotOptions: {
              line: {
                lineWidth: 2,
                marker: {
                  enabled: true,
                  radius: 4,
                  lineWidth: 2,
                  lineColor: COLORS.white,
                  states: {
                    hover: {
                      enabled: true,
                      radius: 6,
                      lineColor: COLORS.white,
                      lineWidth: 2,
                    },
                  },
                },
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [
              {
                name: 'Positive',
                data: [60, 55, 40, 88, 45, 48, 72],
                color: COLORS.chartBlue,
                marker: { symbol: 'circle', fillColor: COLORS.chartBlue },
              },
              {
                name: 'Negative',
                data: [40, 30, 25, 70, 30, 55, 50],
                color: COLORS.chartPink,
                marker: { symbol: 'triangle', fillColor: COLORS.chartPink },
              },
              {
                name: 'Neutral',
                data: [50, 42, 32, 78, 48, 50, 60],
                color: COLORS.fgSubtle,
                marker: { symbol: 'square', fillColor: COLORS.chartGrey },
              },
            ],
          }}
        />
      </div>
    </SidePanel>
  )
}

// ─── 5. Reactions Details Panel ─────────────────────────────────────────────
export function ReactionsPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Reactions"
    >
      {/* Reactions Trend */}
      <div>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Reactions trend
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px', lineHeight: '16px' }}>
          Tracks how positive and negative reactions have changed over time. Use this trend to identify changes that may be driving lower satisfaction.
        </span>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'line',
              height: 240,
              backgroundColor: 'transparent',
              spacingTop: 10,
              spacingBottom: 5,
              spacingLeft: 5,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: {
              enabled: true,
              align: 'right',
              verticalAlign: 'bottom',
              layout: 'horizontal',
              itemStyle: {
                color: 'hsl(var(--text-secondary))',
                fontSize: '12px',
                fontWeight: '400',
              },
              symbolWidth: 16,
              itemDistance: 16,
            },
            xAxis: {
              categories: ['Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              max: 50,
              tickInterval: 10,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                x: -5,
                style: { color: 'hsl(var(--text-secondary))', fontSize: '12px' },
              },
            },
            tooltip: {
              useHTML: true,
              shared: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 12,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:12px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:4px">{point.key}</div>',
              pointFormat: '<div style="font-size:12px;margin-bottom:2px"><span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y}</b></div>',
            },
            plotOptions: {
              line: {
                lineWidth: 2,
                marker: {
                  enabled: true,
                  radius: 4,
                  lineWidth: 2,
                  lineColor: COLORS.white,
                  states: {
                    hover: {
                      enabled: true,
                      radius: 6,
                      lineColor: COLORS.white,
                      lineWidth: 2,
                    },
                  },
                },
              },
              series: {
                animation: { duration: 500 },
              },
            },
            series: [
              {
                name: 'Positive',
                data: [30, 28, 20, 44, 30, 24, 36],
                color: COLORS.chartBlue,
                marker: { symbol: 'circle', fillColor: COLORS.chartBlue },
              },
              {
                name: 'Negative',
                data: [20, 15, 12, 35, 15, 27, 24],
                color: COLORS.chartPink,
                marker: { symbol: 'triangle', fillColor: COLORS.chartPink },
              },
            ],
          }}
        />
      </div>
    </SidePanel>
  )
}

// ─── 6. Answer Rate & Quality Panel ─────────────────────────────────────────
interface AnswerRatePanelProps extends PanelProps {
  answerRateFilter: string;
  setAnswerRateFilter: (filter: string) => void;
}

export function AnswerRatePanel({ open, onClose, answerRateFilter, setAnswerRateFilter, compact }: AnswerRatePanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="text-sm font-semibold text-gray-900">
            Answer rate and quality
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: COLORS.textTertiary,
            backgroundColor: 'hsl(var(--surface-secondary))',
            padding: '0px 4px',
            borderRadius: '2px',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            lineHeight: '16px',
          }}>Preview</span>
        </div>
      }
      headerExtra={
        <div style={{ padding: `0 20px 10px`, flexShrink: 0 }}>
          <PillSwitcher
            compact={compact}
            options={[
              { key: 'all', label: 'All' },
              { key: 'main', label: 'Main agent' },
              { key: 'child', label: 'Child agent' },
            ]}
            value={answerRateFilter}
            onChange={setAnswerRateFilter}
          />
        </div>
      }
    >
      {/* Unanswered Questions */}
      <div style={{ paddingTop: '6px', paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Unanswered questions
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          Reasons the agent didn't answer user questions.
        </span>
        {[
          { label: 'Declined to answer', value: 44, trend: 3, up: true },
          { label: 'Other', value: 15, trend: 2, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartRed, borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Knowledge Source Use */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Knowledge source use
          </span>
          <Tooltip content="How frequently knowledge sources are used to generate answers" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs text-gray-500">
            Answers based on knowledge sources
          </span>
          <Tooltip content="Percentage of answers that were generated using knowledge source content" relationship="description"><Info16Regular style={{ width: '14px', height: '14px', color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-lg font-normal text-gray-900 block">
          75%
        </span>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Source Use Trend */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Source use trend
          </span>
          <Tooltip content="Trend of knowledge source usage over time" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              type: 'line',
              height: 200,
              backgroundColor: 'transparent',
              spacingTop: 5,
              spacingBottom: 5,
              spacingLeft: 5,
              spacingRight: 10,
            },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            legend: {
              enabled: true,
              align: 'left',
              verticalAlign: 'bottom',
              layout: 'horizontal',
              useHTML: true,
              symbolWidth: 0,
              symbolHeight: 0,
              symbolPadding: 0,
              labelFormatter: function(this: Highcharts.Point | Highcharts.Series) {
                return '<span style="display: inline-flex; align-items: center; gap: 5px;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ' + this.color + ';"></span><span style="font-size: ' + '10px' + '; font-weight: 400; color: ' + COLORS.fg3 + ';">' + this.name + '</span></span>';
              },
              itemDistance: 10,
              itemMarginBottom: 4,
            },
            xAxis: {
              categories: ['Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12'],
              lineColor: 'hsl(var(--stroke-default))',
              tickColor: 'hsl(var(--stroke-default))',
              labels: {
                style: { color: 'hsl(var(--text-secondary))', fontSize: '10px' },
              },
            },
            yAxis: {
              title: { text: null },
              min: 0,
              max: 100,
              tickInterval: 50,
              gridLineColor: COLORS.strokeSubtle,
              labels: {
                x: -5,
                format: '{value}%',
                style: { color: 'hsl(var(--text-secondary))', fontSize: '10px' },
              },
            },
            tooltip: {
              useHTML: true,
              shared: true,
              backgroundColor: 'white',
              borderColor: COLORS.strokeSubtle,
              borderRadius: '12px',
              padding: 10,
              shadow: CHART_DEFAULTS.tooltip.shadow,
              headerFormat: '<div style="font-size:11px;font-weight:600;color:hsl(var(--text-secondary));margin-bottom:3px">{point.key}</div>',
              pointFormat: '<div style="font-size:11px;margin-bottom:1px"><span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y}%</b></div>',
            },
            plotOptions: {
              line: {
                lineWidth: 2,
                marker: {
                  enabled: false,
                  symbol: 'circle',
                  states: {
                    hover: { enabled: true, radius: 4, lineColor: COLORS.white, lineWidth: 2 },
                  },
                },
              },
              series: { animation: { duration: 500 } },
            },
            series: [
              { name: 'Datasource #3', data: [45, 52, 48, 60, 55, 58, 50], color: COLORS.chartBlue },
              { name: 'Knowledge source 1', data: [80, 85, 78, 90, 88, 82, 86], color: COLORS.chartPink },
              { name: 'A new knowledge source', data: [30, 35, 28, 42, 38, 32, 36], color: COLORS.chartGreen },
              { name: 'Another source', data: [60, 55, 65, 50, 58, 62, 54], color: COLORS.chartOrange },
              { name: 'Internal wiki', data: [15, 20, 18, 25, 22, 19, 24], color: COLORS.chartPurple },
            ],
          }}
        />
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* All Sources */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
          <span className="text-xs font-semibold text-gray-900">
            All sources
          </span>
          <Tooltip content="Breakdown of all knowledge sources and their usage percentage" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        {[
          { label: 'Knowledge source 1', value: 90, trend: 5, up: true },
          { label: 'Another source of knowledge', value: 62, trend: 3, up: false },
          { label: 'Datasource #3', value: 41, trend: 2, up: false },
          { label: 'Another knowledge source', value: 15, trend: 1, up: true },
          { label: 'Internal wiki for knowledge', value: 13, trend: 4, up: false },
          { label: 'Sharepoint site', value: 6, trend: 1, up: true },
          { label: 'Elaborate Excel file', value: 5, trend: 0, up: null },
          { label: 'Knowledge number 8', value: 0, trend: 1, up: false },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${Math.max(item.value, 1)}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px', minWidth: item.value > 0 ? '4px' : '0px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up === true && <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />}
              {item.up === false && <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />}
              {item.up === null && <span style={{ width: '12px', display: 'inline-block', textAlign: 'center', color: COLORS.textTertiary, fontSize: '10px' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Knowledge Errors */}
      <div style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Knowledge errors
          </span>
          <Tooltip content="Errors encountered when querying knowledge sources" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        {[
          { label: 'SharePoint', value: 44, trend: 3, up: true },
          { label: 'Files', value: 15, trend: 2, up: true },
          { label: 'Public Websites', value: 5, trend: 1, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartRed, borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
            </div>
          </div>
        ))}
        <span className="text-xs font-semibold cursor-pointer inline-block mt-1" style={{ color: COLORS.chartBlue }}>
          Show all
        </span>
      </div>
    </SidePanel>
  )
}

// ─── 7. Outcomes and Engagement Panel ───────────────────────────────────────
export function OutcomesPanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Outcomes and engagement"
    >
      {/* Session Outcomes */}
      <div style={{ paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Session outcomes
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px', lineHeight: '16px' }}>
          Engaged sessions are classified according to their outcome. The more sessions your agent can resolve, the better.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '130px', height: '130px', flexShrink: 0 }}>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: {
                  type: 'pie',
                  backgroundColor: 'transparent',
                  height: 130,
                  width: 130,
                  spacingTop: 0,
                  spacingBottom: 0,
                  spacingLeft: 0,
                  spacingRight: 0,
                },
                title: { text: null },
                credits: { enabled: false },
                accessibility: { enabled: false },
                legend: { enabled: false },
                tooltip: {
                  useHTML: true,
                  backgroundColor: 'white',
                  borderColor: COLORS.strokeSubtle,
                  borderRadius: '12px',
                  padding: 10,
                  shadow: CHART_DEFAULTS.tooltip.shadow,
                  pointFormat: '<span style="font-size:12px"><b>{point.percentage:.0f}%</b> {point.name}</span>',
                },
                plotOptions: {
                  pie: {
                    innerSize: '65%',
                    borderWidth: 3,
                    borderColor: 'white',
                    dataLabels: { enabled: false },
                    states: { hover: { halo: null } },
                  },
                },
                series: [{
                  data: [
                    { name: 'Resolved', y: 45, color: COLORS.chartBlue },
                    { name: 'Escalated', y: 25, color: COLORS.chartPink },
                    { name: 'Abandoned', y: 30, color: COLORS.chartPurple },
                  ],
                }],
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Resolved', value: '45%', color: COLORS.chartBlue },
              { label: 'Escalated', value: '25%', color: COLORS.chartPink },
              { label: 'Abandoned', value: '30%', color: COLORS.chartPurple },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Resolved Outcome Reasons */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Resolved outcome reasons
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          See how resolved outcomes splits between user confirmed resolved and resolve based on Copilot logic.
        </span>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
              <span className="text-xs text-gray-500">Resolved confirmed</span>
              <Tooltip content="User explicitly confirmed the issue was resolved" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
            </div>
            <span className="text-lg font-normal text-gray-900">65%</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
              <span className="text-xs text-gray-500">Resolved implied</span>
              <Tooltip content="Resolution inferred by Copilot logic without explicit user confirmation" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
            </div>
            <span className="text-lg font-normal text-gray-900">25%</span>
          </div>
        </div>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{ width: '72%', backgroundColor: COLORS.chartPink }} />
          <div style={{ width: '28%', backgroundColor: COLORS.chartBlue }} />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.chartPink }} />
            <span className="text-xs text-gray-500">Resolved confirmed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.chartBlue }} />
            <span className="text-xs text-gray-500">Resolved implied</span>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Escalated Outcome Reasons */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Escalated outcome reasons
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          See how escalate outcomes splits between intended escalation that are triggered by users and unintended escalations that are triggered by the agent logic.
        </span>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
              <span className="text-xs text-gray-500">Intended</span>
              <Tooltip content="Escalations triggered intentionally by users requesting human support" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
            </div>
            <span className="text-lg font-normal text-gray-900">65%</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
              <span className="text-xs text-gray-500">Unintended</span>
              <Tooltip content="Escalations triggered by agent logic when unable to resolve the issue" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
            </div>
            <span className="text-lg font-normal text-gray-900">25%</span>
          </div>
        </div>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{ width: '72%', backgroundColor: COLORS.chartPink }} />
          <div style={{ width: '28%', backgroundColor: COLORS.chartBlue }} />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.chartPink }} />
            <span className="text-xs text-gray-500">Intended</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.chartBlue }} />
            <span className="text-xs text-gray-500">Unintended</span>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Topics by Outcome */}
      <div style={{ paddingTop: '16px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Topics by outcome
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px', lineHeight: '16px' }}>
          Tracking the topics that led to each outcome can help you adjust your agent to better resolve your users' issues. The list includes custom topics only.
        </span>

        {/* Resolved */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '10px' }}>
            <span className="text-xs font-semibold text-gray-900">Resolved</span>
            <Tooltip content="Topics that led to resolved conversation outcomes" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
          </div>
          {[
            { label: 'User email', value: 90, up: true },
            { label: 'Product type', value: 44, up: true },
            { label: 'Returns', value: 41, up: true },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '130px' }}>{item.label}</span>
              <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
                <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
                <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
                <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
              </div>
            </div>
          ))}
          <span className="text-xs font-semibold cursor-pointer inline-block" style={{ color: COLORS.chartBlue }}>
            Show all
          </span>
        </div>

        <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0, marginBottom: '12px' }} />

        {/* Escalated */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '10px' }}>
            <span className="text-xs font-semibold text-gray-900">Escalated</span>
            <Tooltip content="Topics that led to escalated conversation outcomes" relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary }} /></Tooltip>
          </div>
          {[
            { label: 'Find product', value: 100, up: true },
            { label: 'Track order', value: 44, up: true },
            { label: 'Check product inventory', value: 41, up: true },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '130px' }}>{item.label}</span>
              <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
                <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
                <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
                <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
              </div>
            </div>
          ))}
          <span className="text-xs font-semibold cursor-pointer inline-block" style={{ color: COLORS.chartBlue }}>
            Show all
          </span>
        </div>
      </div>
    </SidePanel>
  )
}

// ─── 7b. Run Outcomes Panel ─────────────────────────────────────────────────
export function RunOutcomesPanel({ open, onClose, compact }: PanelProps) {
  // Generate 7 days of duration trend data
  const durationTrendData = (() => {
    const now = new Date()
    const data: number[][] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      // Seeded-ish deterministic values between 3.0 and 5.5
      const val = 3.8 + 1.2 * Math.sin(i * 1.3 + 0.7) + 0.3 * Math.cos(i * 2.1)
      data.push([d.getTime(), Math.round(val * 10) / 10])
    }
    return data
  })()

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Run outcomes"
    >
      {/* Duration KPIs */}
      <div style={{ paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '10px' }}>
          Duration
        </span>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '2px' }}>
              <span className="text-lg font-normal text-gray-900">4.2s</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                <span className="text-[11px] font-semibold" style={{ color: COLORS.successText }}>7%</span>
              </div>
            </div>
            <span className="text-xs text-gray-500">Average duration</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '2px' }}>
              <span className="text-lg font-normal text-gray-900">12.8s</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                <span className="text-[11px] font-semibold" style={{ color: COLORS.successText }}>3%</span>
              </div>
            </div>
            <span className="text-xs text-gray-500">P95 duration</span>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Duration Trend Chart */}
      <div style={{ paddingTop: '16px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '10px' }}>
          Duration trend
        </span>
        <div style={{ height: '220px' }}>
          <HighchartsReact
            highcharts={Highcharts}
            containerProps={{ style: { height: '100%' } }}
            options={{
              chart: {
                type: 'areaspline',
                backgroundColor: 'transparent',
                spacingTop: 4,
                spacingBottom: 4,
                spacingLeft: 0,
                spacingRight: 0,
              },
              title: { text: null },
              credits: { enabled: false },
              accessibility: { enabled: false },
              legend: { enabled: false },
              xAxis: {
                type: 'datetime',
                labels: {
                  style: { color: 'hsl(var(--text-tertiary))', fontSize: '10px' },
                  format: '{value:%b %d}',
                },
                lineColor: COLORS.strokeSubtle,
                tickColor: 'transparent',
              },
              yAxis: {
                title: { text: null },
                labels: {
                  style: { color: 'hsl(var(--text-tertiary))', fontSize: '10px' },
                  format: '{value}s',
                },
                gridLineColor: COLORS.strokeSubtle,
                gridLineDashStyle: 'Dash',
                min: 0,
              },
              tooltip: {
                useHTML: true,
                backgroundColor: 'white',
                borderColor: COLORS.strokeSubtle,
                borderRadius: '12px',
                padding: 10,
                shadow: CHART_DEFAULTS.tooltip.shadow,
                xDateFormat: '%b %d',
                pointFormat: '<span style="font-size:12px"><b>{point.y}s</b> avg duration</span>',
              },
              plotOptions: {
                areaspline: {
                  lineWidth: 2,
                  marker: { enabled: false, symbol: 'circle', radius: 3, states: { hover: { enabled: true } } },
                  fillOpacity: 0.08,
                  states: { hover: { lineWidth: 2 } },
                },
              },
              series: [{
                name: 'Duration',
                data: durationTrendData,
                color: COLORS.chartBlue,
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                  stops: [
                    [0, COLORS.chartBlue + '20'],
                    [1, COLORS.chartBlue + '00'],
                  ],
                },
              }],
            }}
          />
        </div>
      </div>
    </SidePanel>
  )
}

// ─── 7c. Trigger Use Panel ──────────────────────────────────────────────────
export function TriggerUsePanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Trigger use"
    >
      {/* Top Used Triggers — Donut */}
      <div style={{ paddingBottom: '12px' }}>
        <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
          Top used triggers
        </span>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '12px', lineHeight: '16px' }}>
          Distribution of the most frequently activated triggers across all runs.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '130px', height: '130px', flexShrink: 0 }}>
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: {
                  type: 'pie',
                  backgroundColor: 'transparent',
                  height: 130,
                  width: 130,
                  spacingTop: 0,
                  spacingBottom: 0,
                  spacingLeft: 0,
                  spacingRight: 0,
                },
                title: { text: null },
                credits: { enabled: false },
                accessibility: { enabled: false },
                legend: { enabled: false },
                tooltip: {
                  useHTML: true,
                  backgroundColor: 'white',
                  borderColor: COLORS.strokeSubtle,
                  borderRadius: '12px',
                  padding: 10,
                  shadow: CHART_DEFAULTS.tooltip.shadow,
                  pointFormat: '<span style="font-size:12px"><b>{point.percentage:.0f}%</b> {point.name}</span>',
                },
                plotOptions: {
                  pie: {
                    innerSize: '65%',
                    borderWidth: 3,
                    borderColor: 'white',
                    dataLabels: { enabled: false },
                    states: { hover: { halo: null } },
                  },
                },
                series: [{
                  data: [
                    { name: 'Scheduled', y: 38, color: COLORS.chartBlue },
                    { name: 'Event-based', y: 28, color: COLORS.chartPink },
                    { name: 'Manual', y: 20, color: COLORS.chartGreen },
                    { name: 'Webhook', y: 14, color: COLORS.chartLavender },
                  ],
                }],
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Scheduled', value: '38%', color: COLORS.chartBlue },
              { label: 'Event-based', value: '28%', color: COLORS.chartPink },
              { label: 'Manual', value: '20%', color: COLORS.chartGreen },
              { label: 'Webhook', value: '14%', color: COLORS.chartLavender },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* All Triggers */}
      <div style={{ paddingTop: '16px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            All triggers
          </span>
          <Tooltip content="Breakdown of all trigger types and their activation frequency" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          The percentage of runs initiated by each trigger type. Triggers with low activation might need configuration changes.
        </span>
        {[
          { label: 'Scheduled daily', value: 82, up: true },
          { label: 'New email received', value: 64, up: true },
          { label: 'Record updated', value: 48, up: false },
          { label: 'Manual run', value: 35, up: true },
          { label: 'Webhook call', value: 22, up: false },
          { label: 'Form submission', value: 14, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${Math.max(item.value, 1)}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px', minWidth: item.value > 0 ? '4px' : '0px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Fail Rate */}
      <div style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Fail rate
          </span>
          <Tooltip content="Percentage of trigger activations that failed to start a run" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          For each trigger, the percentage of activations that failed to start a run successfully.
        </span>
        {[
          { label: 'Webhook call', value: 18, up: true },
          { label: 'Record updated', value: 11, up: true },
          { label: 'Form submission', value: 7, up: false },
          { label: 'New email received', value: 4, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartRed, borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />}
            </div>
          </div>
        ))}
        <span className="text-xs font-semibold cursor-pointer inline-block mt-1" style={{ color: COLORS.chartBlue }}>
          Show all
        </span>
      </div>
    </SidePanel>
  )
}

// ─── 7d. Knowledge Sources Panel ────────────────────────────────────────────
export function KnowledgeSourcesPanel({ open, onClose, compact }: PanelProps) {
  const knowledgeSources = [
    { name: 'Internal wiki for knowledge', color: COLORS.chartPink },
    { name: 'A new knowledge source', color: COLORS.chartGreen },
    { name: 'Another source of knowledge', color: COLORS.chartMagenta },
    { name: 'Datasource #3', color: COLORS.chartBlue },
    { name: 'Knowledge source 1', color: COLORS.chartViolet },
  ]

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Knowledge sources used in runs"
    >
      {/* KPIs */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
        {[
          { label: 'Source use', value: '78%' },
          { label: 'Error rate', value: '3%' },
          { label: 'Answer rate', value: '95%' },
        ].map((kpi) => (
          <div key={kpi.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', whiteSpace: 'nowrap' }}>
              <span className="text-xs text-gray-500">{kpi.label}</span>
              <Tooltip content={kpi.label} relationship="description"><Info16Regular style={{ width: '12px', height: '12px', color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
            </div>
            <span className="text-lg font-normal text-gray-900">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Top source use chart */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
          <span className="text-xs font-semibold text-gray-900">Top source use</span>
          <Tooltip content="Usage trends for top knowledge sources over time" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: { type: 'line', backgroundColor: 'transparent', height: 220, spacingTop: 10, spacingBottom: 5, spacingLeft: 5, spacingRight: 10 },
            title: { text: null },
            credits: { enabled: false },
            accessibility: { enabled: false },
            xAxis: {
              categories: ['Feb 6', 'Feb 7', 'Feb 8', 'Feb 9', 'Feb 10', 'Feb 11', 'Feb 12'],
              labels: { style: { fontSize: '12px', color: 'hsl(var(--text-tertiary))' } },
              gridLineWidth: 0,
              lineColor: COLORS.strokeLight,
              tickWidth: 0,
            },
            yAxis: {
              min: 0, max: 100,
              title: { text: null },
              labels: { format: '{value}%', style: { fontSize: '12px', color: 'hsl(var(--text-tertiary))' } },
              gridLineColor: COLORS.strokeLight,
            },
            legend: {
              enabled: true,
              layout: 'horizontal',
              align: 'left',
              verticalAlign: 'bottom',
              floating: false,
              useHTML: true,
              symbolWidth: 0, symbolHeight: 0, symbolPadding: 0,
              labelFormatter: function(this: Highcharts.Point | Highcharts.Series) {
                return '<span style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ' + this.color + '; flex-shrink: 0;"></span><span style="font-size: 10px; color: ' + COLORS.fg3 + ';">' + this.name + '</span></span>';
              },
              itemDistance: 10,
              itemMarginBottom: 4,
              margin: 12,
              padding: 0,
            },
            tooltip: {
              ...CHART_DEFAULTS.tooltip,
              shared: true,
              style: { fontSize: '12px', color: 'hsl(var(--text-primary))' },
              valueSuffix: '%',
            },
            plotOptions: { line: { marker: { enabled: false }, lineWidth: 2 } },
            series: [
              { name: 'Internal wiki for knowledge', data: [85, 82, 78, 75, 90, 80, 78], color: COLORS.chartPink },
              { name: 'A new knowledge source', data: [45, 48, 52, 50, 55, 52, 54], color: COLORS.chartGreen },
              { name: 'Another source of knowledge', data: [70, 68, 72, 88, 82, 75, 70], color: COLORS.chartMagenta },
              { name: 'Datasource #3', data: [60, 65, 58, 72, 78, 85, 90], color: COLORS.chartBlue },
              { name: 'Knowledge source 1', data: [30, 28, 25, 35, 40, 32, 28], color: COLORS.chartViolet },
            ],
          }}
        />
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* All Sources */}
      <div style={{ paddingTop: '12px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            All sources
          </span>
          <Tooltip content="Breakdown of all knowledge sources and their usage percentage" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          The percentage of runs that used each knowledge source. Sources with low use might need better indexing or relevance tuning.
        </span>
        {[
          { label: 'Product catalog', value: 88, up: true },
          { label: 'FAQ database', value: 72, up: true },
          { label: 'Policy documents', value: 56, up: false },
          { label: 'Troubleshooting guides', value: 41, up: true },
          { label: 'Release notes', value: 23, up: false },
          { label: 'Internal wiki', value: 12, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${Math.max(item.value, 1)}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px', minWidth: item.value > 0 ? '4px' : '0px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Errors */}
      <div style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Errors
          </span>
          <Tooltip content="Error rate for each knowledge source when queried" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          For each source, the percentage of queries that resulted in an error.
        </span>
        {[
          { label: 'Internal wiki', value: 15, up: true },
          { label: 'Policy documents', value: 9, up: true },
          { label: 'Release notes', value: 6, up: false },
          { label: 'Product catalog', value: 3, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartRed, borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />}
            </div>
          </div>
        ))}
        <span className="text-xs font-semibold cursor-pointer inline-block mt-1" style={{ color: COLORS.chartBlue }}>
          Show all
        </span>
      </div>
    </SidePanel>
  )
}

// ─── 8. Tool Use Panel ──────────────────────────────────────────────────────
export function ToolUsePanel({ open, onClose, compact }: PanelProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Tool use"
    >
      {/* All Tools */}
      <div style={{ paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            All tools
          </span>
          <Tooltip content="Breakdown of all tools and their usage percentage across sessions" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          The percentage of sessions that used each tool. Tools with low use might need more specific instructions.
        </span>
        {[
          { label: 'Send email', value: 90, up: true },
          { label: 'Update a row', value: 62, up: false },
          { label: 'Knowledge document creator', value: 41, up: false },
          { label: 'List rows', value: 35, up: true },
          { label: 'Get weather', value: 15, up: true },
          { label: 'Search records', value: 8, up: false },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${Math.max(item.value, 1)}%`, backgroundColor: COLORS.chartBlue, borderRadius: '4px', minWidth: item.value > 0 ? '4px' : '0px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', minHeight: '1px', backgroundColor: COLORS.strokeSubtle, flexShrink: 0 }} />

      {/* Errors */}
      <div style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span className="text-xs font-semibold text-gray-900">
            Errors
          </span>
          <Tooltip content="Error rate for each tool when invoked" relationship="description"><Info16Regular style={{ color: COLORS.textTertiary, cursor: 'pointer' }} /></Tooltip>
        </div>
        <span className="text-xs text-gray-500 block" style={{ marginBottom: '10px', lineHeight: '16px' }}>
          For each tool, the percentage of invocations that resulted in an error.
        </span>
        {[
          { label: 'Send email', value: 12, up: true },
          { label: 'Update a row', value: 8, up: true },
          { label: 'List rows', value: 5, up: false },
          { label: 'Search records', value: 3, up: true },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: '160px' }}>{item.label}</span>
            <div style={{ width: '80px', flexShrink: 0, display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'hsl(var(--surface-secondary))' }}>
              <div style={{ width: `${item.value}%`, backgroundColor: COLORS.chartRed, borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, width: '50px', justifyContent: 'flex-end' }}>
              <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
              {item.up ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} /> : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />}
            </div>
          </div>
        ))}
        <span className="text-xs font-semibold cursor-pointer inline-block mt-1" style={{ color: COLORS.chartBlue }}>
          Show all
        </span>
      </div>
    </SidePanel>
  )
}

// ─── Theme Metrics Panel ─────────────────────────────────────────────────────
interface ThemeMetricsPanelProps extends PanelProps {
  theme: Evaluation;
}

export function ThemeMetricsPanel({ open, onClose, theme, compact }: ThemeMetricsPanelProps) {
  const responseQualitySegments = [
    { label: 'Good', pct: 30.8, color: COLORS.chartGreen },
    { label: 'Incomplete', pct: 25.4, color: COLORS.chartOrange },
    { label: 'Irrelevant', pct: 22.1, color: COLORS.danger },
    { label: 'Knowledge not used', pct: 21.7, color: COLORS.chartPink },
  ]

  const knowledgeSources = [
    { name: 'IT troubleshooting', pct: 75 },
    { name: 'Vacation Policy', pct: 63 },
    { name: 'the HR Notebook', pct: 44 },
    { name: 'Employee Handbook', pct: 38 },
    { name: 'Benefits Guide', pct: 29 },
  ]

  return (
    <SidePanel open={open} onClose={onClose} compact={compact} title="Theme metrics">
      {/* Response quality */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
            Response quality
          </span>
          <span className="text-xs text-gray-500" style={{ lineHeight: '16px' }}>
            The outcome percentage of engaged sessions in which this topic is assigned to.
          </span>
        </div>

        {/* KPI */}
        <div>
          <span className="text-xs text-gray-500 block" style={{ marginBottom: '2px' }}>Good</span>
          <span className="text-lg font-normal text-gray-900">30.8%</span>
        </div>

        {/* Stacked bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', height: '10px', borderRadius: '4px', overflow: 'hidden' }}>
            {responseQualitySegments.map(seg => (
              <div
                key={seg.label}
                title={`${seg.label}: ${seg.pct}%`}
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: seg.color,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {responseQualitySegments.map(seg => (
              <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
                <span className="text-xs text-gray-500">{seg.label}</span>
                <span className="text-xs font-semibold text-gray-900">{seg.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}`, margin: '20px 0' }} />

      {/* Knowledge source use */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <span className="text-xs font-semibold text-gray-900 block" style={{ marginBottom: '2px' }}>
            Knowledge source use
          </span>
          <span className="text-xs text-gray-500" style={{ lineHeight: '16px' }}>
            The percentage of questions that used each source. Sources with low use might need more specific instructions.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {knowledgeSources.map(source => (
            <div key={source.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="text-xs text-gray-500">{source.name}</span>
                <span className="text-xs font-semibold text-gray-900">{source.pct}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: '4px', backgroundColor: COLORS.strokeSubtle, overflow: 'hidden' }}>
                <div
                  title={`${source.name}: ${source.pct}%`}
                  style={{
                    width: `${source.pct}%`,
                    height: '100%',
                    borderRadius: '4px',
                    backgroundColor: COLORS.chartBlue,
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SidePanel>
  )
}

// ─── Inline SVG icons for question detail ───────────────────────────────────
const ThumbUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.052 2.29418C10.3913 1.31688 11.6841 0.866611 12.4829 1.70374C12.6455 1.87416 12.8081 2.05832 12.9176 2.22254C13.2379 2.70305 13.3725 3.33584 13.4218 3.9522C13.4721 4.58034 13.438 5.25446 13.3738 5.86473C13.3093 6.47735 13.2129 7.03948 13.1328 7.44766C13.1294 7.46535 13.1259 7.48277 13.1225 7.49989H14.006C15.8777 7.49989 17.2924 9.19503 16.9576 11.0365L16.2737 14.7983C15.8017 17.3942 13.2078 19.0289 10.6622 18.3347L5.06251 16.8075C4.14894 16.5583 3.45455 15.8144 3.26885 14.8859L2.91581 13.1207C2.63809 11.7321 3.69991 10.5623 4.82905 10.116C5.15163 9.9885 5.44337 9.82668 5.66974 9.62586C7.37583 8.11234 7.99442 6.90276 9.05406 4.77684C9.4084 4.06594 9.77205 3.10043 10.052 2.29418ZM12.0165 7.87851L12.0169 7.87696L12.0187 7.86962L12.0262 7.83852C12.0328 7.81068 12.0426 7.76892 12.0549 7.71482C12.0793 7.60658 12.1135 7.44919 12.1515 7.25525C12.2277 6.86655 12.3188 6.33493 12.3793 5.76005C12.4401 5.18282 12.4685 4.57569 12.425 4.03195C12.3806 3.47644 12.2652 3.04673 12.0855 2.77724C12.0264 2.68859 11.9138 2.55593 11.7594 2.3941C11.5605 2.18565 11.1314 2.23417 10.9967 2.62217C10.7141 3.43598 10.3334 4.45183 9.94904 5.22294C8.88216 7.36338 8.19326 8.72396 6.33336 10.3739C5.99304 10.6758 5.58878 10.891 5.19665 11.046C4.31631 11.394 3.75035 12.1944 3.89639 12.9246L4.24943 14.6898C4.36085 15.2469 4.77748 15.6932 5.32562 15.8427L10.9254 17.3699C12.9052 17.9099 14.9227 16.6384 15.2898 14.6194L15.9738 10.8577C16.197 9.62998 15.2538 8.49989 14.006 8.49989H12.5015C12.3476 8.49989 12.2022 8.42895 12.1074 8.3076C12.0127 8.18627 11.9792 8.02785 12.0165 7.87851C12.0165 7.87847 12.0165 7.87855 12.0165 7.87851Z" fill="currentColor"/>
  </svg>
)
const ThumbDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.052 17.7057C10.3913 18.683 11.6841 19.1333 12.4829 18.2962C12.6455 18.1257 12.8081 17.9416 12.9176 17.7774C13.2379 17.2968 13.3725 16.6641 13.4218 16.0477C13.4721 15.4195 13.438 14.7454 13.3738 14.1352C13.3093 13.5225 13.2129 12.9604 13.1328 12.5522C13.1294 12.5345 13.1259 12.5171 13.1225 12.5H14.006C15.8777 12.5 17.2924 10.8049 16.9576 8.96334L16.2737 5.20164C15.8017 2.60569 13.2078 0.970952 10.6622 1.66519L5.06251 3.19239C4.14894 3.44154 3.45455 4.18547 3.26885 5.11401L2.91581 6.87918C2.63809 8.2678 3.69991 9.43756 4.82905 9.88388C5.15163 10.0114 5.44337 10.1732 5.66974 10.374C7.37583 11.8875 7.99442 13.0971 9.05406 15.2231C9.4084 15.9339 9.77205 16.8995 10.052 17.7057ZM12.0165 12.1214L12.0169 12.1229L12.0187 12.1303L12.0262 12.1614C12.0328 12.1892 12.0426 12.231 12.0549 12.2851C12.0793 12.3933 12.1135 12.5507 12.1515 12.7446C12.2277 13.1333 12.3188 13.665 12.3793 14.2398C12.4401 14.8171 12.4685 15.4242 12.425 15.9679C12.3806 16.5235 12.2652 16.9532 12.0855 17.2227C12.0264 17.3113 11.9138 17.444 11.7594 17.6058C11.5605 17.8142 11.1314 17.7657 10.9967 17.3777C10.7141 16.5639 10.3334 15.5481 9.94904 14.777C8.88216 12.6365 8.19326 11.2759 6.33336 9.62597C5.99304 9.32406 5.58878 9.1089 5.19665 8.9539C4.31631 8.60592 3.75035 7.80549 3.89639 7.0753L4.24943 5.31013C4.36085 4.753 4.77748 4.30665 5.32562 4.15715L10.9254 2.62995C12.9052 2.08999 14.9227 3.36145 15.2898 5.38053L15.9738 9.14223C16.197 10.3699 15.2538 11.5 14.006 11.5H12.5015C12.3476 11.5 12.2022 11.5709 12.1074 11.6923C12.0127 11.8136 11.9792 11.972 12.0165 12.1214C12.0165 12.1214 12.0165 12.1213 12.0165 12.1214Z" fill="currentColor"/>
  </svg>
)
const CommentIconSvg = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2C14.4183 2 18 5.07068 18 8.86364C18 12.6566 14.4183 15.7273 10 15.7273C9.43595 15.7273 8.88636 15.6771 8.35674 15.5814L5.55726 17.8418C5.19213 18.1367 4.66532 17.8739 4.66532 17.4052V14.2041C3.02949 12.9316 2 11.0155 2 8.86364C2 5.07068 5.58172 2 10 2ZM10 3C6.13401 3 3 5.62264 3 8.86364C3 10.7345 3.96835 12.3855 5.48424 13.4505L5.66532 13.5709V16.3024L7.87915 14.5167L8.14256 14.5918C8.73498 14.7609 9.35838 14.8542 10 14.8542C13.866 14.8542 17 12.2316 17 8.86364C17 5.62264 13.866 3 10 3Z" fill="currentColor"/>
  </svg>
)

interface QuestionDetailPanelProps extends PanelProps {
  question: Question;
  mode?: string;
}

export function QuestionDetailPanel({ open, onClose, question, mode = 'questions', compact }: QuestionDetailPanelProps) {
  if (!open || !question) return null
  const q = question
  const qIsAnswered = q.answered !== false
  const qScores = Object.values(q.testScores || {})
  const qQualityPct = qScores.length > 0 ? Math.round((qScores.filter(s => s === 'Pass').length / qScores.length) * 100) : 50
  const qQualityLabel = qQualityPct >= 70 ? 'Good' : qQualityPct >= 50 ? 'Average' : 'Poor'
  const qQualityColor = qQualityPct >= 70 ? COLORS.success : qQualityPct >= 50 ? COLORS.warning : COLORS.danger
  const qQualityBg = qQualityPct >= 70 ? COLORS.successBgSubtle : qQualityPct >= 50 ? COLORS.warningBgSubtle : COLORS.dangerBgSubtle

  const subtitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {q.date && <span className="text-xs text-gray-500">{q.date}</span>}
      {mode !== 'comments' && <StatusBadge variant={qIsAnswered ? 'success' : 'danger'}>{qIsAnswered ? 'Answered' : 'Unanswered'}</StatusBadge>}
    </div>
  )

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title={mode === 'comments' ? 'Comment details' : 'Query & response details'}
      subtitle={subtitle}
    >
      {/* User Query & Response */}
      <div style={{
        border: `1px solid ${COLORS.strokeSubtle}`,
        borderRadius: '12px',
        padding: `12px 16px`,
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
            User query
          </span>
          <span className="text-xs text-gray-900" style={{ lineHeight: '20px' }}>
            {mode === 'comments' ? (q.userQuery || '—') : q.question}
          </span>
        </div>
        {(mode === 'comments' ? q.agentResponse : (qIsAnswered && q.agentResponse)) && (
          <div>
            <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
              Response
            </span>
            <span className="text-xs text-gray-900" style={{ lineHeight: '20px' }}>
              {q.agentResponse}
            </span>
          </div>
        )}
      </div>

      {/* Reaction & Comment */}
      <div style={{ paddingBottom: '16px' }}>
        <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '10px' }}>
          User reaction
        </span>
        {q.reaction ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}>
                {q.reaction === 'up' ? <ThumbUpIcon /> : <ThumbDownIcon />}
              </span>
              <span className="text-xs text-gray-900">
                {q.reaction === 'up' ? 'Thumbs up' : 'Thumbs down'}
              </span>
            </div>
            {(mode === 'comments' ? q.question : q.comment) && (
              <span className="text-xs text-gray-500" style={{ lineHeight: '20px' }}>
                {mode === 'comments' ? q.question : q.comment}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">No reaction provided</span>
        )}
      </div>

      {mode !== 'comments' && (
      <>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}` }} />

      {/* Response Quality */}
      <div style={{ padding: `16px 0` }}>
        <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '10px' }}>
          Response quality
        </span>
        {qIsAnswered ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '20px',
                padding: `0 6px`,
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: qQualityBg,
                color: qQualityColor,
              }}>
                {qQualityLabel}
              </span>
              <span className="text-xs text-gray-500">
                {qQualityPct}% score
              </span>
            </div>
            {/* Individual test scores */}
            {Object.keys(q.testScores || {}).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                {Object.entries(q.testScores).map(([method, score]) => (
                  <div key={method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-xs text-gray-500">{method}</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: `0 6px`,
                      borderRadius: '4px',
                      backgroundColor: score === 'Pass' ? COLORS.successBgSubtle : COLORS.dangerBgSubtle,
                      color: score === 'Pass' ? COLORS.success : COLORS.danger,
                    }}>
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">Not applicable -- question was unanswered</span>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}` }} />

      {/* Knowledge Sources */}
      <div style={{ paddingTop: '16px' }}>
        <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '10px' }}>
          Knowledge sources
        </span>
        {q.knowledgeSources && q.knowledgeSources.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {q.knowledgeSources.map((source, sIdx) => {
              const iconStyle: React.CSSProperties = { flexShrink: 0, width: '18px', height: '18px' }
              const lc = source.toLowerCase()
              let SourceIcon: React.ReactNode
              if (lc.endsWith('.pdf')) SourceIcon = <DocumentText20Color style={{ ...iconStyle, filter: 'hue-rotate(160deg) saturate(1.5)' }} />
              else if (lc.endsWith('.docx') || lc.endsWith('.doc')) SourceIcon = <DocumentText20Color style={iconStyle} />
              else if (lc.endsWith('.pptx') || lc.endsWith('.ppt')) SourceIcon = <img src="/PowerPoint.svg" alt="PowerPoint" style={iconStyle} />
              else if (lc.includes('database') || lc.includes('db')) SourceIcon = <Database20Regular style={{ ...iconStyle, color: COLORS.success }} />
              else if (lc.includes('sharepoint')) SourceIcon = <img src="/SharePoint-new.svg" alt="SharePoint" style={iconStyle} />
              else if (lc.includes('portal') || lc.includes('web') || lc.includes('site') || lc.includes('www.') || lc.includes('.com') || lc.includes('.org')) SourceIcon = <Globe20Filled style={{ ...iconStyle, color: COLORS.msBlue }} />
              else SourceIcon = <Document20Color style={iconStyle} />
              return (
                <div key={sIdx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: `4px 0`,
                }}>
                  {SourceIcon}
                  <span className="text-xs text-gray-900 flex-1">
                    {source}
                  </span>
                  <ArrowExport20Regular style={{ color: COLORS.textTertiary, flexShrink: 0, width: '14px', height: '14px', cursor: 'default' }} />
                </div>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-gray-500">No knowledge sources cited</span>
        )}
      </div>
      </>
      )}

      {/* Knowledge Sources (comments mode) */}
      {mode === 'comments' && q.knowledgeSources && q.knowledgeSources.length > 0 && (
      <>
        <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}` }} />
        <div style={{ paddingTop: '16px' }}>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '10px' }}>
            Knowledge sources
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {q.knowledgeSources.map((source, sIdx) => {
              const iconStyle: React.CSSProperties = { flexShrink: 0, width: '18px', height: '18px' }
              const lc = source.toLowerCase()
              let SourceIcon: React.ReactNode
              if (lc.endsWith('.pdf')) SourceIcon = <DocumentText20Color style={{ ...iconStyle, filter: 'hue-rotate(160deg) saturate(1.5)' }} />
              else if (lc.endsWith('.docx') || lc.endsWith('.doc')) SourceIcon = <DocumentText20Color style={iconStyle} />
              else if (lc.endsWith('.pptx') || lc.endsWith('.ppt')) SourceIcon = <img src="/PowerPoint.svg" alt="PowerPoint" style={iconStyle} />
              else if (lc.includes('database') || lc.includes('db')) SourceIcon = <Database20Regular style={{ ...iconStyle, color: COLORS.success }} />
              else if (lc.includes('sharepoint')) SourceIcon = <img src="/SharePoint-new.svg" alt="SharePoint" style={iconStyle} />
              else if (lc.includes('portal') || lc.includes('web') || lc.includes('site') || lc.includes('www.') || lc.includes('.com') || lc.includes('.org')) SourceIcon = <Globe20Filled style={{ ...iconStyle, color: COLORS.msBlue }} />
              else SourceIcon = <Document20Color style={iconStyle} />
              return (
                <div key={sIdx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: `4px 0`,
                }}>
                  {SourceIcon}
                  <span className="text-xs text-gray-900 flex-1">
                    {source}
                  </span>
                  <ArrowExport20Regular style={{ color: COLORS.textTertiary, flexShrink: 0, width: '14px', height: '14px', cursor: 'default' }} />
                </div>
              )
            })}
          </div>
        </div>
      </>
      )}
    </SidePanel>
  )
}

// ─── Session Detail Panel ───────────────────────────────────────────────────
const OUTCOME_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { 'Resolved confirmed': 'success', 'Resolved implied': 'success', 'Agent transfer': 'warning', 'Abandoned': 'danger' }

interface SessionDetailPanelProps extends PanelProps {
  session: Session;
}

export function SessionDetailPanel({ open, onClose, session, compact }: SessionDetailPanelProps) {
  const [showTranscript, setShowTranscript] = useState(false)

  if (!open || !session) return null

  const conversation = session.conversation || []
  const firstUserMsg = conversation.find(m => m.role === 'user')
  const firstAgentMsg = conversation.find(m => m.role === 'agent')
  const totalTurns = conversation.length
  const previewTurns = (firstUserMsg ? 1 : 0) + (firstAgentMsg ? 1 : 0)
  const remainingTurns = totalTurns - previewTurns

  const subtitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', overflow: 'hidden' }}>
      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{session.startTime}</span>
      <span style={{ flexShrink: 0 }}>
        <StatusBadge variant={OUTCOME_VARIANT[session.outcome] || 'success'}>{session.outcome}</StatusBadge>
      </span>
    </div>
  )

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      compact={compact}
      title="Session details"
      subtitle={subtitle}
    >
      {/* Conversation preview card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowTranscript(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTranscript(true) } }}
        style={{
          border: `1px solid ${COLORS.strokeSubtle}`,
          borderRadius: '12px',
          padding: `12px 16px`,
          marginBottom: '16px',
          cursor: 'pointer',
          transition: `background ${'0.1s'} ${'ease'}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(var(--surface-secondary))' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
      >
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span className="text-xs font-semibold text-gray-900">Conversation</span>
          <Tooltip content="View full transcript" relationship="label">
            <CopilotButton variant="icon-subtle" size="xs" onClick={(e) => { e.stopPropagation(); setShowTranscript(true) }} aria-label="View full transcript"><Eye20Regular /></CopilotButton>
          </Tooltip>
        </div>

        {/* First question */}
        {firstUserMsg && (
          <div style={{ marginBottom: '8px' }}>
            <span className="text-xs font-semibold text-gray-500">Question: </span>
            <span className="text-xs text-gray-500" style={{ lineHeight: '16px' }}>
              {firstUserMsg.text.length > 120 ? firstUserMsg.text.slice(0, 120) + '...' : firstUserMsg.text}
            </span>
          </div>
        )}

        {/* First agent response */}
        {firstAgentMsg && (
          <div style={{ marginBottom: remainingTurns > 0 ? '8px' : 0 }}>
            <span className="text-xs font-semibold text-gray-500">Agent response: </span>
            <span className="text-xs text-gray-500" style={{ lineHeight: '16px' }}>
              {firstAgentMsg.text.length > 120 ? firstAgentMsg.text.slice(0, 120) + '...' : firstAgentMsg.text}
            </span>
          </div>
        )}

        {/* Remaining turns */}
        {remainingTurns > 0 && (
          <span className="text-xs text-gray-500">
            + {remainingTurns} more turn{remainingTurns > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}` }} />

      {/* Session info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: `12px 16px`,
        paddingTop: '16px',
      }}>
        <div>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
            Duration
          </span>
          <span className="text-xs text-gray-900">{session.duration}</span>
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
            Messages
          </span>
          <span className="text-xs text-gray-900">{session.messages}</span>
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
            Outcome reason
          </span>
          <span className="text-xs text-gray-900">{session.reason}</span>
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-500 block" style={{ marginBottom: '2px' }}>
            Channel
          </span>
          <span className="text-xs text-gray-900">{session.channel}</span>
        </div>
      </div>

      {/* Full transcript dialog */}
      <ElevateDialog isOpen={showTranscript} onClose={() => setShowTranscript(false)} maxWidth="4xl" maxHeight="calc(100vh - 48px)">
        <ElevateDialogHeader onClose={() => setShowTranscript(false)}>
          <div>
            <ElevateDialogTitle>Session Transcript</ElevateDialogTitle>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {(() => {
                const d = new Date(session.startTime)
                const pad = (n: number) => String(n).padStart(2, '0')
                const ts = `${d.getMonth() + 1}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
                return `${ts} · ${session.messages} Messages · ${session.outcome} · ${session.reason} · ${session.channel}`
              })()}
            </p>
          </div>
        </ElevateDialogHeader>
        <ElevateDialogContent>
          <div style={{
            border: `1px solid ${COLORS.strokeSubtle}`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {conversation.map((msg, idx) => {
              const msgTime = (() => {
                const d = new Date(session.startTime)
                d.setMinutes(d.getMinutes() + idx * 2)
                const pad = (n: number) => String(n).padStart(2, '0')
                return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
              })()
              return msg.role === 'user' ? (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span className="text-[10px] text-gray-400">{msgTime}</span>
                  <div style={{ backgroundColor: 'hsl(var(--surface-secondary))', borderRadius: '12px', padding: '8px 12px', maxWidth: '70%' }}>
                    <span className="text-xs text-gray-900" style={{ lineHeight: '16px' }}>{msg.text}</span>
                  </div>
                </div>
              ) : (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="#0078d4" />
                        <path d="M7 12.5C7 10.5 8.5 7 12 7C15.5 7 17 10 17 12C17 14 15.5 16.5 13 17L12.5 14.5C14 14 15 13 15 12C15 10.5 14 9 12 9C10 9 9 10.5 9 12C9 13 9.5 13.8 10.5 14.3L10 17C8 16 7 14.5 7 12.5Z" fill="white" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Agent</span>
                    <span className="text-[10px] text-gray-400">{msgTime}</span>
                  </div>
                  <div style={{ paddingLeft: '28px' }}>
                    <span className="text-xs text-gray-900" style={{ lineHeight: '16px' }}>{msg.text}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </ElevateDialogContent>
      </ElevateDialog>
    </SidePanel>
  )
}
