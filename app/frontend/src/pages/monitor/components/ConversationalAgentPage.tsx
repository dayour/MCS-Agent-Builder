import React, { useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import 'react-day-picker/style.css'
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
  MoreHorizontal20Regular,
  Comment16Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Calendar20Regular,
} from '@fluentui/react-icons'
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '../../../components/ui/Dialog'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import { COLORS, CLS } from '../constants'
import { buildOutcomeChartOptions, buildAnswerQualityChartOptions, lineChartBase, TOOL_USE_SERIES, AGENT_CLICK_EVALUATION, type QuestionsEvaluation } from '../chartHelpers'
import { EvaluationsGrid, AgentsGrid, KnowledgeSourcesGrid } from './Grids'
import { SectionHeader, AISummaryCard, OverviewKPICard, PillSwitcher } from './SharedComponents'
import type { Evaluation, Agent, KnowledgeSource, CustomMetric } from '../types'

interface ConversationalAgentPageProps {
  timeRange: string
  setTimeRange: (value: string) => void
  isCustomDateDialogOpen: boolean
  setIsCustomDateDialogOpen: (open: boolean) => void
  customStartDate: Date | undefined
  customEndDate: Date | undefined
  setCustomStartDate: (date: Date | undefined) => void
  setCustomEndDate: (date: Date | undefined) => void
  suggestionsExpanded: boolean
  setSuggestionsExpanded: (expanded: boolean) => void
  showSuggestionSkeleton: boolean
  setShowActiveUsersPanel: (show: boolean) => void
  setShowBillingPanel: (show: boolean) => void
  setShowOutcomesPanel: (show: boolean) => void
  setShowKnowledgeSourcesPanel: (show: boolean) => void
  setShowToolUsePanel: (show: boolean) => void
  setShowReactionsPanel: (show: boolean) => void
  setShowSatisfactionPanel: (show: boolean) => void
  setShowSentimentPanel: (show: boolean) => void
  setShowAnswerRatePanel: (show: boolean) => void
  evaluations: Evaluation[]
  themeFilter: string
  setThemeFilter: (filter: string) => void
  setIsAddThemeDialogOpen: (open: boolean) => void
  handleTrackTheme: (theme: Evaluation) => void
  handleOpenEditTheme: (theme: Evaluation) => void
  handleDeleteTheme: (themeId: string) => void
  handleSeeSessions: () => void
  handleEvaluationClick: (evaluation: Evaluation) => void
  handleKnowledgeSourceClick: (source: KnowledgeSource) => void
  questionsEvaluation: Evaluation | null
  mockAgents: Agent[]
  onShowMetrics: (item: Evaluation) => void
  onEvaluate: (item: Evaluation) => void
  customMetrics: CustomMetric[]
  setEditingMetricIndex: (index: number | null) => void
  setIsCustomMetricDialogOpen: (open: boolean) => void
  setDeleteMetricIndex: (index: number | null) => void
}

function ConversationalAgentPage({
  timeRange, setTimeRange,
  isCustomDateDialogOpen, setIsCustomDateDialogOpen,
  customStartDate, customEndDate,
  setCustomStartDate, setCustomEndDate,
  suggestionsExpanded, setSuggestionsExpanded,
  showSuggestionSkeleton,
  // Panel openers
  setShowActiveUsersPanel,
  setShowBillingPanel,
  setShowOutcomesPanel,
  setShowKnowledgeSourcesPanel,
  setShowToolUsePanel,
  setShowReactionsPanel,
  setShowSatisfactionPanel,
  setShowSentimentPanel,
  setShowAnswerRatePanel,
  // Themes
  evaluations,
  themeFilter, setThemeFilter,
  setIsAddThemeDialogOpen,
  handleTrackTheme,
  handleOpenEditTheme,
  handleDeleteTheme,
  handleSeeSessions,
  handleEvaluationClick,
  handleKnowledgeSourceClick,
  questionsEvaluation,
  mockAgents,
  onShowMetrics,
  onEvaluate,
  // Custom metrics
  customMetrics,
  setEditingMetricIndex,
  setIsCustomMetricDialogOpen,
  setDeleteMetricIndex,
}: ConversationalAgentPageProps) {
  const [bottomTab, setBottomTab] = useState('knowledge')
  const [startDateMenuOpen, setStartDateMenuOpen] = useState(false)
  const [endDateMenuOpen, setEndDateMenuOpen] = useState(false)

  return (
                <div className="px-4 py-0 pb-2.5 box-border">
                    <div className="max-w-full mx-auto">

                      {/* AI Summary Section */}
                      <AISummaryCard
                        expanded={suggestionsExpanded}
                        setExpanded={setSuggestionsExpanded}
                        showSkeleton={showSuggestionSkeleton}
                        collapsedText="Conversation sessions are steady at 20,356. Engagement is up 5% with strong user satisfaction."
                      >
                        <li>Conversation sessions are steady at 20,356 with 78% engagement rate. Average DAU is 289, up 8% from last period.</li>
                        <li>Copilot credit usage is at 12,450 credits, up 8%. Consider optimizing conversation flows to reduce unnecessary API calls.</li>
                        <li>Time savings reached 387 hours ($12,771 cost savings) this period, demonstrating strong automation value.</li>
                        <li>Thumbs up reactions at 75% — review themes showing lower response quality to improve overall outcomes.</li>
                        <li>Customer satisfaction score is 3.2/5.0, up 5%. Focus on reducing the 25% dissatisfied segment.</li>
                      </AISummaryCard>

                      {/* Overview Cards - Three Column Layout */}
                      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2.5 mb-2.5">
                        {/* Overview Card */}
                        <OverviewKPICard
                          title="Overview"
                          tooltip="Key performance metrics including conversation sessions, engagement rate, reactions, and daily active users"
                          kpis={[
                            { value: '20,356', label: 'Conversation sessions', trend: { pct: '5%', up: false } },
                            { value: '78%', label: 'Engagement', trend: { pct: '5%', up: true } },
                            { value: '569', label: 'Reactions', trend: { pct: '5%', up: true } },
                            { value: '289', label: 'Average DAU', trend: { pct: '8%', up: true } },
                          ]}
                          actionLabel="See active users"
                          onAction={() => setShowActiveUsersPanel(true)}
                        />

                        {/* Billing Card */}
                        <OverviewKPICard
                          title="Billing"
                          tooltip="Copilot credits consumed during the selected time period"
                          kpis={[
                            { value: '12,450', label: 'Copilot credits used', trend: { pct: '8%', up: true } },
                          ]}
                          actionLabel="See billing"
                          onAction={() => setShowBillingPanel(true)}
                        />

                        {/* Savings Card */}
                        <OverviewKPICard
                          title="Savings"
                          tooltip="Estimated time and cost savings from automated agent interactions"
                          kpis={[
                            { value: '387 hrs', label: 'Time', trend: { pct: '5%', up: true } },
                            { value: '$12,771', label: 'Cost', trend: { pct: '8%', up: true } },
                          ]}
                        >
                          <Menu>
                            <MenuTrigger disableButtonEnhancement>
                              <button type="button" className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="More options">
                                <MoreHorizontal20Regular className="w-4 h-4" />
                              </button>
                            </MenuTrigger>
                            <MenuPopover>
                              <MenuList>
                                <MenuItem>See details</MenuItem>
                                <MenuItem>Remove</MenuItem>
                              </MenuList>
                            </MenuPopover>
                          </Menu>
                        </OverviewKPICard>
                      </div>

                      {/* Conversation Outcome Chart */}
                      <div className={`${CLS.card} p-3 mb-2.5`}>
                        <div className="flex justify-between items-center mb-2">
                          <SectionHeader title="Conversation outcome" tooltip="Distribution of conversation results: resolved, escalated, abandoned, and unresolved" />
                          <div className="flex items-center gap-2">
                            <CopilotButton variant="outline" size="xs" onClick={() => setShowOutcomesPanel(true)}>See details</CopilotButton>
                            <CopilotButton variant="outline" size="xs" onClick={handleSeeSessions}>See sessions</CopilotButton>
                          </div>
                        </div>
                        <div className="relative">
                          <HighchartsReact
                            highcharts={Highcharts}
                            containerProps={{ style: { height: '100%' } }}
                            options={buildOutcomeChartOptions({ timeRange, customStartDate, customEndDate, seed: 42 })}
                          />
                        </div>
                      </div>

                    {/* Reactions Row — all three cards side by side */}
                    <div className="flex gap-2.5 items-stretch mb-2.5">
                    {/* Reactions Card */}
                    <section className="flex-1 min-w-0">
                      <div className={`${CLS.card} p-3 h-full flex flex-col gap-2`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <SectionHeader title="Reactions" tooltip="User feedback reactions including thumbs up, thumbs down, and other responses" />
                          <div className="flex items-center gap-2">
                            <Tooltip content="See user comments" relationship="description">
                              <CopilotButton variant="outline" size="xs" style={{ width: '24px', padding: 0, justifyContent: 'center' }} onClick={() => handleEvaluationClick({ id: 'comments', name: 'Comments', evaluatedItem: { type: 'auto', name: 'Comments', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'comments' })} aria-label="See user comments">
                                <Comment16Regular className="w-3.5 h-3.5" />
                              </CopilotButton>
                            </Tooltip>
                            <CopilotButton variant="outline" size="xs" onClick={() => setShowReactionsPanel(true)}>See details</CopilotButton>
                          </div>
                        </div>
                        {/* KPIs + Donut — side by side */}
                        <div className="flex items-center gap-2.5">
                          {/* KPIs */}
                          <div className="flex flex-col gap-2.5 flex-shrink-0">
                            <div className="flex flex-col">
                              <div className="flex items-baseline gap-1 mb-0.5">
                                <span className="text-lg font-normal text-gray-900">75%</span>
                                <div className="flex items-center gap-0.5">
                                  <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                                  <span className="text-[11px] font-semibold" style={{ color: COLORS.successText }}>5%</span>
                                </div>
                              </div>
                              <span className="text-xs" style={{ color: COLORS.textTertiary }}>Thumbs up</span>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-baseline gap-1 mb-0.5">
                                <span className="text-lg font-normal text-gray-900">25%</span>
                                <div className="flex items-center gap-0.5">
                                  <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                                  <span className="text-[11px] font-semibold" style={{ color: COLORS.dangerText }}>5%</span>
                                </div>
                              </div>
                              <span className="text-xs" style={{ color: COLORS.textTertiary }}>Thumbs down</span>
                            </div>
                          </div>
                          {/* Donut with callouts */}
                          <div className="flex-1 flex justify-center items-center">
                            {(() => {
                              const cx = 80, cy = 70, R = 55, r = 36
                              const toRad = (d: number) => d * Math.PI / 180
                              const px = (a: number, rad: number) => cx + rad * Math.sin(toRad(a))
                              const py = (a: number, rad: number) => cy - rad * Math.cos(toRad(a))
                              const tdEdgeX = px(20, R), tdEdgeY = py(20, R)
                              const tuEdgeX = px(150, R), tuEdgeY = py(150, R)
                              return (
                                <svg viewBox="0 0 210 140" width="210" height="140" style={{ overflow: 'visible' }}>
                                  <defs>
                                    <style>{`.donut-seg{cursor:pointer;transition:opacity 0.2s,filter 0.2s}.donut-seg:hover{opacity:0.75;filter:brightness(1.08)}`}</style>
                                  </defs>
                                  <Tooltip relationship="label" positioning="above" content={<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '9999px', backgroundColor: COLORS.chartLavender, flexShrink: 0 }} />Thumbs up: <strong>75%</strong> (568 reactions)</div><div style={{ color: '#0F6CBD', fontSize: '12px' }}>{'\u2192'} Click to see responses</div></div>}>
                                    <path className="donut-seg" d={`M ${px(47,R)} ${py(47,R)} A ${R} ${R} 0 1 1 ${px(313,R)} ${py(313,R)} L ${px(313,r)} ${py(313,r)} A ${r} ${r} 0 1 0 ${px(47,r)} ${py(47,r)} Z`}
                                      fill={COLORS.chartLavender}
                                      onClick={() => handleEvaluationClick({ id: 'responses', name: 'Responses', evaluatedItem: { type: 'auto', name: 'Responses', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'responses', initialReactionFilter: 'up' })} />
                                  </Tooltip>
                                  <Tooltip relationship="label" positioning="above" content={<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '9999px', backgroundColor: COLORS.chartPink, flexShrink: 0 }} />Thumbs down: <strong>25%</strong> (190 reactions)</div><div style={{ color: '#0F6CBD', fontSize: '12px' }}>{'\u2192'} Click to see responses</div></div>}>
                                    <path className="donut-seg" d={`M ${px(317,R)} ${py(317,R)} A ${R} ${R} 0 0 1 ${px(43,R)} ${py(43,R)} L ${px(43,r)} ${py(43,r)} A ${r} ${r} 0 0 0 ${px(317,r)} ${py(317,r)} Z`}
                                      fill={COLORS.chartPink}
                                      onClick={() => handleEvaluationClick({ id: 'responses', name: 'Responses', evaluatedItem: { type: 'auto', name: 'Responses', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'responses', initialReactionFilter: 'down' })} />
                                  </Tooltip>
                                  <circle cx={cx} cy={cy} r="34" fill={COLORS.white} />
                                  <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: '10px', fontWeight: '400', fill: COLORS.textTertiary }}>Total</text>
                                  <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: '14px', fontWeight: '600', fill: COLORS.textPrimary }}>758</text>
                                  <polyline points={`${tdEdgeX},${tdEdgeY} ${tdEdgeX + 8},${tdEdgeY - 6} ${tdEdgeX + 22},${tdEdgeY - 6}`} fill="none" stroke={COLORS.strokeLight} strokeWidth="1" />
                                  <text x={tdEdgeX + 25} y={tdEdgeY - 2} style={{ fontSize: '11px', fill: COLORS.textSecondary }}>Thumbs down</text>
                                  <polyline points={`${tuEdgeX},${tuEdgeY} ${tuEdgeX + 8},${tuEdgeY + 6} ${tuEdgeX + 22},${tuEdgeY + 6}`} fill="none" stroke={COLORS.strokeLight} strokeWidth="1" />
                                  <text x={tuEdgeX + 25} y={tuEdgeY + 10} style={{ fontSize: '11px', fill: COLORS.textSecondary }}>Thumbs up</text>
                                </svg>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Customer Satisfaction Card */}
                    <section className="flex-1 min-w-0">
                      <div className={`${CLS.card} p-3 h-full flex flex-col gap-2`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <SectionHeader title="Customer satisfaction" tooltip="Average satisfaction score from post-session CSAT surveys" />
                          <CopilotButton variant="outline" size="xs" onClick={() => setShowSatisfactionPanel(true)}>See details</CopilotButton>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-baseline gap-1 mb-0.5">
                              <span className="text-lg font-normal text-gray-900">3.2</span>
                              <span className="text-xs" style={{ color: COLORS.textTertiary }}>/5.0</span>
                              <div className="flex items-center gap-0.5 ml-1">
                                <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                                <span className="text-[11px] font-semibold" style={{ color: COLORS.successText }}>5%</span>
                              </div>
                            </div>
                            <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>Satisfaction score for 345 surveys</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>Satisfaction by session</span>
                            <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden' }}>
                              <Tooltip content="Dissatisfied: 25%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '25%', backgroundColor: COLORS.chartPink, borderRadius: '6px 0 0 6px' }} />
                              </Tooltip>
                              <Tooltip content="Neutral: 30%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '30%', backgroundColor: 'rgba(0,0,0,0.09)' }} />
                              </Tooltip>
                              <Tooltip content="Satisfied: 45%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '45%', backgroundColor: COLORS.chartBlue, borderRadius: '0 6px 6px 0' }} />
                              </Tooltip>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {[
                                { label: 'Dissatisfied', pct: '25%', color: COLORS.chartPink },
                                { label: 'Neutral', pct: '30%', color: 'rgba(0,0,0,0.09)' },
                                { label: 'Satisfied', pct: '45%', color: COLORS.chartBlue },
                              ].map(seg => (
                                <div key={seg.label} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                  <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>{seg.label}</span>
                                  <span className="text-[11px] font-semibold">{seg.pct}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Sentiment Card */}
                    <section className="flex-1 min-w-0">
                      <div className={`${CLS.card} p-3 h-full flex flex-col gap-2`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <SectionHeader title="Sentiment" tooltip="AI-powered analysis of user sentiment across all sessions" />
                          <CopilotButton variant="outline" size="xs" onClick={() => setShowSentimentPanel(true)}>See details</CopilotButton>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-baseline gap-1 mb-0.5">
                              <span className="text-lg font-normal text-gray-900">60%</span>
                              <div className="flex items-center gap-0.5 ml-1">
                                <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                                <span className="text-[11px] font-semibold" style={{ color: COLORS.dangerText }}>2%</span>
                              </div>
                            </div>
                            <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>Sessions with negative sentiment</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>Sentiment</span>
                            <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden' }}>
                              <Tooltip content="Negative: 18%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '18%', backgroundColor: COLORS.chartRed, borderRadius: '6px 0 0 6px' }} />
                              </Tooltip>
                              <Tooltip content="Neutral: 20%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '20%', backgroundColor: 'rgba(0,0,0,0.09)' }} />
                              </Tooltip>
                              <Tooltip content="Positive: 62%" relationship="label" positioning="above">
                                <div className="cursor-pointer transition-opacity hover:opacity-70" style={{ width: '62%', backgroundColor: COLORS.chartGreen, borderRadius: '0 6px 6px 0' }} />
                              </Tooltip>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {[
                                { label: 'Negative', pct: '18%', color: COLORS.chartRed },
                                { label: 'Neutral', pct: '20%', color: 'rgba(0,0,0,0.09)' },
                                { label: 'Positive', pct: '62%', color: COLORS.chartGreen },
                              ].map(seg => (
                                <div key={seg.label} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                  <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>{seg.label}</span>
                                  <span className="text-[11px] font-semibold">{seg.pct}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px]" style={{ color: COLORS.textDisabled }}>AI-generated content may be incorrect</span>
                      </div>
                    </section>
                    </div>

                    {/* Custom Metrics Row */}
                    {customMetrics.length > 0 && (
                      <div className="flex gap-2.5 items-stretch mb-2.5">
                        {customMetrics.map((metric, metricIdx) => {
                          const METRIC_COLORS = [COLORS.chartBlue, COLORS.chartPink, COLORS.chartTeal, COLORS.chartPurple, COLORS.chartOrange, COLORS.chartGreen, COLORS.chartLavender, COLORS.chartRed]
                          const cats = (metric.categories || []).filter(c => c.description.trim())
                          const getCatName = (desc: string) => {
                            if (!desc || !desc.trim()) return 'Other'
                            const colonMatch = desc.match(/^([^:]{2,30}):/)
                            if (colonMatch) return colonMatch[1].trim().split(/\s+/).slice(0, 2).join(' ')
                            const adjectives = ['very', 'not', 'highly', 'somewhat', 'slightly', 'extremely', 'moderately', 'partially', 'fully', 'mostly']
                            const words = desc.trim().split(/\s+/).filter(w => w.length > 1)
                            if (words.length >= 2 && adjectives.includes(words[0].toLowerCase())) {
                              return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                            }
                            const meaningful = words.filter(w => w.length > 2)
                            if (meaningful.length >= 2) return meaningful.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                            return meaningful[0] || words[0] || 'Other'
                          }
                          const mockPcts = [45, 25, 15, 10, 8, 5]
                          const otherPct = 10
                          const catPcts = mockPcts.slice(0, cats.length)
                          const total = catPcts.reduce((a, b) => a + b, 0) + otherPct
                          const segments: { label: string; pct: number; color: string }[] = cats.map((c, i) => ({
                            label: getCatName(c.description),
                            pct: Math.round((catPcts[i] / total) * 100),
                            color: METRIC_COLORS[i % METRIC_COLORS.length] as string,
                          }))
                          segments.push({ label: 'Other', pct: Math.round((otherPct / total) * 100), color: COLORS.chartGrey })

                          // Donut chart rendering
                          const donutSize = 140
                          const thickness = 24
                          const donutR = (donutSize - thickness) / 2
                          const donutCx = donutSize / 2
                          const gapDeg = 3
                          const totalGapDeg = gapDeg * segments.length
                          const usableDeg = 360 - totalGapDeg

                          let currentAngle = -90
                          const arcs = segments.map((seg) => {
                            const sweepDeg = (seg.pct / 100) * usableDeg
                            const startAngle = currentAngle
                            const endAngle = startAngle + sweepDeg
                            currentAngle = endAngle + gapDeg
                            const toRad = (d: number) => d * Math.PI / 180
                            const x1 = donutCx + donutR * Math.cos(toRad(startAngle))
                            const y1 = donutCx + donutR * Math.sin(toRad(startAngle))
                            const x2 = donutCx + donutR * Math.cos(toRad(endAngle))
                            const y2 = donutCx + donutR * Math.sin(toRad(endAngle))
                            const largeArc = sweepDeg > 180 ? 1 : 0
                            return { ...seg, d: `M ${x1} ${y1} A ${donutR} ${donutR} 0 ${largeArc} 1 ${x2} ${y2}` }
                          })

                          return (
                            <section key={metricIdx} className="flex-1 min-w-0">
                              <div className={`${CLS.card} p-3 h-full flex flex-col gap-2`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-semibold text-gray-900">{metric.metricName}</span>
                                  <Menu>
                                    <MenuTrigger disableButtonEnhancement>
                                      <button type="button" className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-50 bg-transparent border-none cursor-pointer transition-colors" aria-label="More options">
                                        <MoreHorizontal20Regular className="w-4 h-4" />
                                      </button>
                                    </MenuTrigger>
                                    <MenuPopover>
                                      <MenuList>
                                        <MenuItem onClick={() => { setEditingMetricIndex(metricIdx); setIsCustomMetricDialogOpen(true) }}>Edit</MenuItem>
                                        <MenuItem onClick={() => setDeleteMetricIndex(metricIdx)}>Delete</MenuItem>
                                      </MenuList>
                                    </MenuPopover>
                                  </Menu>
                                </div>
                                <div className="flex items-center gap-8 flex-1">
                                  {/* Donut chart */}
                                  <div className="flex-shrink-0">
                                    <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                                      {arcs.map((arc, i) => (
                                        <path
                                          key={i}
                                          d={arc.d}
                                          fill="none"
                                          stroke={arc.color}
                                          strokeWidth={thickness}
                                          strokeLinecap="butt"
                                        />
                                      ))}
                                    </svg>
                                  </div>
                                  {/* Legend */}
                                  <div className="flex flex-col gap-3">
                                    {segments.map((seg, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                        <span className="text-xs text-gray-500">{seg.label}</span>
                                        <span className="text-xs font-semibold text-gray-900">{seg.pct}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </section>
                          )
                        })}
                        {/* Empty placeholders for remaining slots */}
                        {Array.from({ length: 3 - customMetrics.length }).map((_, i) => (
                          <section key={`empty-${i}`} className="flex-1 min-w-0" />
                        ))}
                      </div>
                    )}

                    {/* Themes Section */}
                    <section className="mb-2.5">
                      <div className={`${CLS.card} overflow-hidden`}>
                      <div className="flex items-center justify-between gap-2 p-3 pb-2 min-h-[48px] box-border">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-500">Themes</span>
                          <PillSwitcher options={[{key:'all',label:'All'},{key:'tracked',label:'Tracked'},{key:'auto',label:'Suggested'}]} value={themeFilter} onChange={setThemeFilter} />
                        </div>
                        <div className="flex items-center gap-2">
                          <CopilotButton variant="outline" size="xs" onClick={() => setIsAddThemeDialogOpen(true)}>Add theme</CopilotButton>
                          <CopilotButton variant="outline" size="xs">See all</CopilotButton>
                        </div>
                      </div>
                      <EvaluationsGrid
                        data={evaluations.filter(item => {
                          if (themeFilter === 'all') return true;
                          if (themeFilter === 'tracked') return item.evaluatedItem?.type === 'tracked';
                          if (themeFilter === 'auto') return item.evaluatedItem?.type === 'auto';
                          return true;
                        })}
                        onEvaluationClick={handleEvaluationClick}
                        onTrackTheme={handleTrackTheme}
                        onEditTheme={handleOpenEditTheme}
                        onDeleteTheme={handleDeleteTheme}
                        onShowMetrics={onShowMetrics}
                        onEvaluate={onEvaluate}
                      />
                      </div>
                    </section>

                    {/* Answer Quality Section */}
                    <div className="mb-2.5">
                      <div className={`${CLS.card} p-3`}>
                        <div className="flex justify-between items-center mb-2">
                          <SectionHeader title="Generated answer rate and quality" tooltip="Percentage of questions answered by the agent and the quality of generated responses" />
                          <div className="flex items-center gap-2">
                            <CopilotButton variant="outline" size="xs" onClick={() => setShowAnswerRatePanel(true)}>See details</CopilotButton>
                            <CopilotButton variant="outline" size="xs" onClick={() => questionsEvaluation && handleEvaluationClick(questionsEvaluation)}>See questions</CopilotButton>
                          </div>
                        </div>
                        <div className="flex gap-8">
                          <div className="flex flex-col gap-4 flex-shrink-0 min-w-[160px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">789</span>
                              <span className="text-xs text-gray-500">Total questions</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">78%</span>
                              <span className="text-xs text-gray-500">Answered questions</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">22%</span>
                              <span className="text-xs text-gray-500">Unanswered questions</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-500">Quality of generated answers</span>
                            <div className="mt-1">
                              <HighchartsReact
                                highcharts={Highcharts}
                                options={buildAnswerQualityChartOptions({ handleEvaluationClick: handleEvaluationClick as unknown as (evaluation: QuestionsEvaluation) => void, questionsEvaluation: questionsEvaluation as unknown as QuestionsEvaluation })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Capabilities used */}
                    <section className="mb-2.5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-gray-500">Capabilities used</span>
                        <PillSwitcher
                          options={[
                            { key: 'knowledge', label: 'Knowledge' },
                            { key: 'tools', label: 'Tools' },
                            { key: 'agents', label: 'Agents' },
                          ]}
                          value={bottomTab}
                          onChange={setBottomTab}
                        />
                      </div>
                    </section>

                    {/* Tool Use Section */}
                    <section className="mb-2.5" style={{ display: bottomTab === 'tools' ? 'block' : 'none' }}>
                      <div className={`${CLS.card} overflow-hidden`}>
                        <div className="flex items-center justify-between gap-2 p-3 pb-2 min-h-[48px] box-border">
                          <SectionHeader title="Tool use" tooltip="Tools invoked by the agent and their success rates" />
                          <CopilotButton variant="outline" size="xs" onClick={() => setShowToolUsePanel(true)}>See details</CopilotButton>
                        </div>
                        <div className="flex gap-4 px-3 pb-3">
                          <div className="flex flex-col gap-4 flex-shrink-0 min-w-[120px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">756</span>
                              <span className="text-xs text-gray-500">Total tool use</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">95%</span>
                              <span className="text-xs text-gray-500">Success rate</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-500">Top tools used</span>
                            <HighchartsReact
                              highcharts={Highcharts}
                              options={{ ...lineChartBase, series: TOOL_USE_SERIES }}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Knowledge Section */}
                    <section className="mb-2.5" style={{ display: bottomTab === 'knowledge' ? 'block' : 'none' }}>
                      <div className={`${CLS.card} overflow-hidden`}>
                        <div className="flex items-center justify-between gap-2 p-3 pb-2 min-h-[48px] box-border">
                          <SectionHeader title="Knowledge sources" tooltip="Knowledge sources used by the agent to generate responses" />
                          <CopilotButton variant="outline" size="xs" onClick={() => setShowKnowledgeSourcesPanel(true)}>See details</CopilotButton>
                        </div>
                        <KnowledgeSourcesGrid onKnowledgeSourceClick={handleKnowledgeSourceClick} />
                      </div>
                    </section>

                    {/* Triggers Section */}
                    <section className="mb-2.5" style={{ display: bottomTab === 'triggers' ? 'block' : 'none' }}>
                      <div className={`${CLS.card} overflow-hidden`}>
                        <div className="flex items-center justify-between gap-2 p-3 pb-2 min-h-[48px] box-border">
                          <SectionHeader title="Triggers" tooltip="Events and conditions that activate the agent" />
                          <CopilotButton variant="outline" size="xs">See details</CopilotButton>
                        </div>
                        <div className="flex gap-4 px-3 pb-3">
                          <div className="flex flex-col gap-4 flex-shrink-0 min-w-[120px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">8</span>
                              <span className="text-xs text-gray-500">Active triggers</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">1,245</span>
                              <span className="text-xs text-gray-500">Invocations</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-lg font-normal text-gray-900">98%</span>
                              <span className="text-xs text-gray-500">Success rate</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Agents Section */}
                    <section className="mb-2.5" style={{ display: bottomTab === 'agents' ? 'block' : 'none' }}>
                      <div className={`${CLS.card} overflow-hidden`}>
                        <div className="flex items-center justify-between gap-2 p-3 pb-2 min-h-[48px] box-border">
                          <span className="text-sm font-semibold text-gray-500">Agents</span>
                        </div>
                        <AgentsGrid
                          data={mockAgents}
                          onAgentClick={(agent) => {
                            handleEvaluationClick({ ...AGENT_CLICK_EVALUATION, name: agent.name })
                          }}
                        />
                      </div>
                    </section>

                    {/* Custom Test Methods Section - Hidden for now */}

                    {/* Custom Date Range Dialog */}
                    <Dialog isOpen={isCustomDateDialogOpen} onClose={() => setIsCustomDateDialogOpen(false)} maxWidth="lg">
                      <DialogHeader onClose={() => setIsCustomDateDialogOpen(false)}>
                        <DialogTitle>Custom time range</DialogTitle>
                      </DialogHeader>
                      <DialogContent>
                        <div className="flex gap-6">
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Start date</label>
                            <Menu open={startDateMenuOpen} onOpenChange={(e, data) => setStartDateMenuOpen(data.open)}>
                              <MenuTrigger disableButtonEnhancement>
                                <CopilotInput
                                  appearance="filled-darker"
                                  value={customStartDate ? format(customStartDate, 'EEEE, M/d/yyyy') : ''}
                                  readOnly
                                  contentAfter={<Calendar20Regular />}
                                  style={{ cursor: 'pointer', width: '100%' }}
                                />
                              </MenuTrigger>
                              <MenuPopover>
                                <DayPicker
                                  mode="single"
                                  selected={customStartDate as any}
                                  onSelect={(date: any) => {
                                    if (date) {
                                      setCustomStartDate(date)
                                      setStartDateMenuOpen(false)
                                    }
                                  }}
                                  disabled={(date: any) => customEndDate ? date > customEndDate : false}
                                  formatters={{ formatWeekdayName: (date: Date) => format(date, 'EEEEE').toUpperCase() }}
                                  components={{ Chevron: () => <ChevronDown20Regular /> }}
                                />
                              </MenuPopover>
                            </Menu>
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-900 mb-1.5">End date</label>
                            <Menu open={endDateMenuOpen} onOpenChange={(e, data) => setEndDateMenuOpen(data.open)}>
                              <MenuTrigger disableButtonEnhancement>
                                <CopilotInput
                                  appearance="filled-darker"
                                  value={customEndDate ? format(customEndDate, 'EEEE, M/d/yyyy') : ''}
                                  readOnly
                                  contentAfter={<Calendar20Regular />}
                                  style={{ cursor: 'pointer', width: '100%' }}
                                />
                              </MenuTrigger>
                              <MenuPopover>
                                <DayPicker
                                  mode="single"
                                  selected={customEndDate as any}
                                  onSelect={(date: any) => {
                                    if (date) {
                                      setCustomEndDate(date)
                                      setEndDateMenuOpen(false)
                                    }
                                  }}
                                  disabled={(date: any) => (customStartDate ? date < customStartDate : false) || date > new Date()}
                                  formatters={{ formatWeekdayName: (date: Date) => format(date, 'EEEEE').toUpperCase() }}
                                  components={{ Chevron: () => <ChevronDown20Regular /> }}
                                />
                              </MenuPopover>
                            </Menu>
                          </div>
                        </div>
                      </DialogContent>
                      <DialogFooter>
                        <CopilotButton variant="secondary" size="md" onClick={() => setIsCustomDateDialogOpen(false)}>Cancel</CopilotButton>
                        <CopilotButton variant="primary" size="md" onClick={() => { setTimeRange('custom'); setIsCustomDateDialogOpen(false) }}>Select</CopilotButton>
                      </DialogFooter>
                    </Dialog>

                  </div>
                </div>
  )
}

export default ConversationalAgentPage
