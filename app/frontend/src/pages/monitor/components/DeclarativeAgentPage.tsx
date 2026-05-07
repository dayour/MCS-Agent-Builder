import React, { useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowUp16Regular,
  ArrowDown16Regular,
  Comment16Regular,
  ChevronRight16Regular,
} from '@fluentui/react-icons'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { COLORS, CLS } from '../constants'
import { buildAnswerQualityChartOptions, lineChartBase, TOOL_USE_SERIES, ENGAGEMENT_SERIES, type QuestionsEvaluation } from '../chartHelpers'
import { EvaluationsGrid, KnowledgeSourcesGrid } from './Grids'
import { KPIItem, SectionHeader, ChartCard, AISummaryCard, OverviewKPICard, PillSwitcher } from './SharedComponents'
import type { Evaluation, Topic } from '../types'

// ─── Mock Topic Data ─────────────────────────────────────────────────────────
const MOCK_TOPICS = [
  { id: 't1', name: 'Password Reset', sessions: 1245, resolution: 92, avgDuration: '1.8m', trend: { pct: '8%', up: true }, description: 'Users requesting password resets or account recovery', topQuestions: ['How do I reset my password?', 'I forgot my email password', 'Account locked out'] },
  { id: 't2', name: 'Leave Policy', sessions: 892, resolution: 87, avgDuration: '2.1m', trend: { pct: '3%', up: true }, description: 'Questions about PTO, sick leave, and absence policies', topQuestions: ['How many days of PTO do I get?', 'How to apply for sick leave?', 'Carry-over policy'] },
  { id: 't3', name: 'Expense Reimbursement', sessions: 756, resolution: 78, avgDuration: '3.2m', trend: { pct: '5%', up: false }, description: 'Expense submission, approval status, and reimbursement inquiries', topQuestions: ['How to submit an expense?', 'Reimbursement timeline?', 'Approved expense categories'] },
  { id: 't4', name: 'IT Troubleshooting', sessions: 634, resolution: 65, avgDuration: '4.5m', trend: { pct: '12%', up: true }, description: 'Software issues, hardware problems, and connectivity troubleshooting', topQuestions: ['VPN not connecting', 'Outlook not syncing', 'Printer setup help'] },
  { id: 't5', name: 'Benefits Enrollment', sessions: 523, resolution: 81, avgDuration: '2.8m', trend: { pct: '2%', up: false }, description: 'Health insurance, 401k, and other benefits enrollment questions', topQuestions: ['When is open enrollment?', 'How to add a dependent?', 'FSA vs HSA difference'] },
  { id: 't6', name: 'Onboarding', sessions: 412, resolution: 90, avgDuration: '3.5m', trend: { pct: '15%', up: true }, description: 'New hire onboarding processes and orientation questions', topQuestions: ['First day checklist', 'How to set up laptop?', 'Badge access request'] },
]

interface DeclarativeAgentPageProps {
  elevate: boolean
  timeRange: string
  setTimeRange: (value: string) => void
  setIsCustomDateDialogOpen: (open: boolean) => void
  customStartDate: Date
  customEndDate: Date
  suggestionsExpanded: boolean
  setSuggestionsExpanded: (expanded: boolean) => void
  showSuggestionSkeleton: boolean
  setShowActiveUsersPanel: (show: boolean) => void
  setShowBillingPanel: (show: boolean) => void
  setShowReactionsPanel: (show: boolean) => void
  setShowSatisfactionPanel: (show: boolean) => void
  setShowSentimentPanel: (show: boolean) => void
  setShowAnswerRatePanel: (show: boolean) => void
  setShowOutcomesPanel: (show: boolean) => void
  setShowKnowledgeSourcesPanel: (show: boolean) => void
  setShowToolUsePanel: (show: boolean) => void
  evaluations: Evaluation[]
  themeFilter: string
  setThemeFilter: (filter: string) => void
  setIsAddThemeDialogOpen: (open: boolean) => void
  handleTrackTheme: (theme: Evaluation) => void
  handleOpenEditTheme: (theme: Evaluation) => void
  handleDeleteTheme: (themeId: string) => void
  handleSeeSessions: () => void
  handleEvaluationClick: (evaluation: Evaluation) => void
  questionsEvaluation: Evaluation | null
  onShowMetrics: (item: Evaluation) => void
  onEvaluate: (item: Evaluation) => void
  onTopicClick: (topic: Topic) => void
}

function DeclarativeAgentPage({
  elevate,
  timeRange, setTimeRange, setIsCustomDateDialogOpen,
  customStartDate, customEndDate,
  suggestionsExpanded, setSuggestionsExpanded,
  showSuggestionSkeleton,
  // Panel openers
  setShowActiveUsersPanel,
  setShowBillingPanel,
  setShowReactionsPanel,
  setShowSatisfactionPanel,
  setShowSentimentPanel,
  setShowAnswerRatePanel,
  setShowOutcomesPanel,
  setShowKnowledgeSourcesPanel,
  setShowToolUsePanel,
  // Themes
  evaluations,
  themeFilter, setThemeFilter,
  setIsAddThemeDialogOpen,
  handleTrackTheme,
  handleOpenEditTheme,
  handleDeleteTheme,
  // Navigation
  handleSeeSessions,
  handleEvaluationClick,
  questionsEvaluation,
  onShowMetrics,
  onEvaluate,
  // Topic detail
  onTopicClick,
}: DeclarativeAgentPageProps) {
  const [bottomTab, setBottomTab] = useState('knowledge')

  return (
    <div className={CLS.pageRoot}>
      <div className={CLS.pageInner}><div className="max-w-full mx-auto">

        {/* AI Summary Section */}
        <AISummaryCard
          expanded={suggestionsExpanded}
          setExpanded={setSuggestionsExpanded}
          showSkeleton={showSuggestionSkeleton}
          collapsedText="Declarative agent sessions grew 10% this week. Average DAU is 289 with strong engagement."
        >
          <li>Your declarative agent saw 10% session growth this week with 15,230 total sessions. Daily active users averaged 289.</li>
          <li>Average user messages per session is 4.2, up from 3.8 last period. Users are engaging more deeply with the agent.</li>
          <li>Average session duration is 2.4 minutes. "Password Reset" is the top topic with 92% resolution rate.</li>
          <li>Thumbs up reactions at 72% — consider reviewing "Expense Reimbursement" topic where resolution dropped 5%.</li>
          <li>Knowledge source utilization is at 89%. Six topics cover 85% of all sessions — review low-volume topics for consolidation.</li>
        </AISummaryCard>

        {/* Overview Cards - Three Column Layout */}
        <div style={{ marginBottom: '10px' }}>
          <OverviewKPICard
            title="Overview"
            tooltip="Key performance metrics including total sessions, daily active users, messages per session, and average duration"
            actionLabel="See active users"
            onAction={() => setShowActiveUsersPanel(true)}
            kpis={[
              { value: '15,230', label: 'Total sessions', trend: { pct: '10%', up: true } },
              { value: '289', label: 'Average DAU', trend: { pct: '8%', up: true } },
              { value: '4.2', label: 'Avg user messages', trend: { pct: '5%', up: true } },
              { value: '2.4m', label: 'Average duration', trend: { pct: '3%', up: false } },
            ]}
          />
        </div>

        {/* ───── Engagement + Reactions Row ───── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          {/* Engagement Chart */}
          <div className={CLS.card} style={{ padding: '12px' }}>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Engagement" tooltip="Usage trends showing sessions and daily active users over the selected time period" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CopilotButton variant="outline" size="xs" onClick={() => setShowActiveUsersPanel(true)}>See details</CopilotButton>
                <CopilotButton variant="outline" size="xs" onClick={handleSeeSessions}>See sessions</CopilotButton>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* KPIs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="text-lg font-normal text-gray-900">1,654</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                      <span className="text-xs font-semibold" style={{ color: COLORS.dangerText }}>2%</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Total sessions</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="text-lg font-normal text-gray-900">1,235</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                      <span className="text-xs font-semibold" style={{ color: COLORS.successText }}>5%</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Total users</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="text-lg font-normal text-gray-900">3,854</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                      <span className="text-xs font-semibold" style={{ color: COLORS.dangerText }}>5%</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">MAU</span>
                </div>
              </div>
              {/* Chart */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-xs" style={{ color: COLORS.textSubtle }}>Use trend</span>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={{ ...lineChartBase, plotOptions: { ...lineChartBase.plotOptions, areaspline: { fillOpacity: 0.12, lineWidth: 2, marker: { enabled: true, radius: 3, symbol: 'circle', states: { hover: { enabled: true, radius: 5, lineWidth: 2 } } } } }, series: ENGAGEMENT_SERIES }}
                />
              </div>
            </div>
          </div>

          {/* Reactions Card */}
          <div className={CLS.card} style={{ padding: '12px' }}>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Reactions" tooltip="User feedback reactions including thumbs up, thumbs down, and other responses" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tooltip content="See user comments" relationship="description"><CopilotButton aria-label="View user comments" variant="icon-subtle" size="xs" onClick={() => handleEvaluationClick({ id: 'comments', name: 'Comments', evaluatedItem: { type: 'auto', name: 'Comments', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'comments' })}><Comment16Regular /></CopilotButton></Tooltip>
                <CopilotButton variant="outline" size="xs" onClick={() => setShowReactionsPanel(true)}>See details</CopilotButton>
              </div>
            </div>
            {/* KPIs + Donut — side by side, vertically centred */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              {/* KPIs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                <KPIItem value="72%" trend="3%" trendUp label="Thumbs up" />
                <KPIItem value="28%" trend="3%" trendUp={false} label="Thumbs down" />
              </div>
              {/* Donut + callout labels */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                {(() => {
                  const cx = 80, cy = 55, R = 48, r = 32
                  const toRad = (d: number) => d * Math.PI / 180
                  const px = (a: number, rad: number) => cx + rad * Math.sin(toRad(a))
                  const py = (a: number, rad: number) => cy - rad * Math.cos(toRad(a))
                  // Edge points for callout lines
                  const tdAngle = 0, tuAngle = 180
                  const tdEdgeX = px(tdAngle, R), tdEdgeY = py(tdAngle, R)
                  const tuEdgeX = px(tuAngle, R), tuEdgeY = py(tuAngle, R)
                  return (
                    <svg viewBox="0 0 200 110" width="200" height="110">
                      <defs>
                        <style>{`.donut-seg{cursor:pointer;transition:opacity 0.2s,filter 0.2s}.donut-seg:hover{opacity:0.75;filter:brightness(1.08)}`}</style>
                      </defs>
                      <Tooltip relationship="label" positioning="above" content={<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '9999px', backgroundColor: COLORS.chartLavender, flexShrink: 0 }} />Thumbs up: <strong>72%</strong> (489 reactions)</div><div style={{ color: '#0F6CBD', fontSize: '12px' }}>{'\u2192'} Click to see responses</div></div>}>
                            <path className="donut-seg" d={`M ${px(47,R)} ${py(47,R)} A ${R} ${R} 0 1 1 ${px(313,R)} ${py(313,R)} L ${px(313,r)} ${py(313,r)} A ${r} ${r} 0 1 0 ${px(47,r)} ${py(47,r)} Z`}
                              fill={COLORS.chartLavender}
                              onClick={() => handleEvaluationClick({ id: 'responses', name: 'Responses', evaluatedItem: { type: 'auto', name: 'Responses', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'responses', initialReactionFilter: 'up' })} />
                      </Tooltip>
                      <Tooltip relationship="label" positioning="above" content={<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '9999px', backgroundColor: COLORS.chartPink, flexShrink: 0 }} />Thumbs down: <strong>28%</strong> (190 reactions)</div><div style={{ color: '#0F6CBD', fontSize: '12px' }}>{'\u2192'} Click to see responses</div></div>}>
                            <path className="donut-seg" d={`M ${px(317,R)} ${py(317,R)} A ${R} ${R} 0 0 1 ${px(43,R)} ${py(43,R)} L ${px(43,r)} ${py(43,r)} A ${r} ${r} 0 0 0 ${px(317,r)} ${py(317,r)} Z`}
                              fill={COLORS.chartPink}
                              onClick={() => handleEvaluationClick({ id: 'responses', name: 'Responses', evaluatedItem: { type: 'auto', name: 'Responses', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'responses', initialReactionFilter: 'down' })} />
                      </Tooltip>
                      <circle cx={cx} cy={cy} r={r - 2} fill={COLORS.white} />
                      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: '10px', fontWeight: '400', fill: COLORS.textTertiary }}>Total</text>
                      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: '14px', fontWeight: '600', fill: COLORS.textPrimary }}>679</text>
                      {/* Callout lines */}
                      <polyline points={`${tdEdgeX},${tdEdgeY} ${tdEdgeX + 8},${tdEdgeY - 6} ${tdEdgeX + 22},${tdEdgeY - 6}`} fill="none" stroke={COLORS.strokeLight} strokeWidth="1" />
                      <text x={tdEdgeX + 25} y={tdEdgeY - 2} style={{ fontSize: '11px', fill: COLORS.textSecondary }}>Thumbs down</text>
                      <polyline points={`${tuEdgeX},${tuEdgeY} ${tuEdgeX - 8},${tuEdgeY + 6} ${tuEdgeX - 22},${tuEdgeY + 6}`} fill="none" stroke={COLORS.strokeLight} strokeWidth="1" />
                      <text x={tuEdgeX - 25} y={tuEdgeY + 10} textAnchor="end" style={{ fontSize: '11px', fill: COLORS.textSecondary }}>Thumbs up</text>
                    </svg>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ───── Themes Grid ───── */}
        <section className="mb-2.5">
          <div className={CLS.card}>
          <div className="flex items-center justify-between p-3 pb-0">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="text-sm font-semibold text-gray-500">Themes</span>
              <PillSwitcher options={[{key:'all',label:'All'},{key:'tracked',label:'Tracked'},{key:'auto',label:'Suggested'}]} value={themeFilter} onChange={setThemeFilter} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* ───── Generated answer rate and quality ───── */}
        <div style={{ marginBottom: '10px' }}>
          <ChartCard
            title="Generated answer rate and quality"
            tooltip="Percentage of questions answered by the agent and the quality of generated responses"
            style={{ padding: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', justifyContent: 'flex-end' }}>
              <CopilotButton variant="outline" size="xs" onClick={() => setShowAnswerRatePanel(true)}>See details</CopilotButton>
              <CopilotButton variant="outline" size="xs" onClick={() => questionsEvaluation && handleEvaluationClick(questionsEvaluation)}>See questions</CopilotButton>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '160px' }}>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">654</span>
                  <span className="text-xs text-gray-500">Total questions</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">82%</span>
                  <span className="text-xs text-gray-500">Answered questions</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">18%</span>
                  <span className="text-xs text-gray-500">Unanswered questions</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-xs" style={{ color: COLORS.textSubtle }}>Quality of generated answers</span>
                <div style={{ position: 'relative' }}>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={buildAnswerQualityChartOptions({ handleEvaluationClick: handleEvaluationClick as unknown as (evaluation: QuestionsEvaluation) => void, questionsEvaluation: questionsEvaluation as unknown as QuestionsEvaluation })}
                  />
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* ───── Capabilities used ───── */}
        <section className="mb-2.5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="text-sm font-semibold text-gray-500">Capabilities used</span>
            <PillSwitcher options={[{ key: 'knowledge', label: 'Knowledge' }, { key: 'tools', label: 'Tools' }]} value={bottomTab} onChange={setBottomTab} />
          </div>
        </section>

        {/* Tool Use */}
        <section className="mb-2.5" style={{ display: bottomTab === 'tools' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Tool use" tooltip="Tools invoked by the agent and their success rates" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowToolUsePanel(true)}>See details</CopilotButton>
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '0 14px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">523</span>
                  <span className="text-xs text-gray-500">Total tool use</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">92%</span>
                  <span className="text-xs text-gray-500">Success rate</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-xs" style={{ color: COLORS.textSubtle }}>Top tools used</span>
                <HighchartsReact highcharts={Highcharts} options={{ ...lineChartBase, series: TOOL_USE_SERIES }} />
              </div>
            </div>
          </div>
        </section>

        {/* Knowledge Sources */}
        <section className="mb-2.5" style={{ display: bottomTab === 'knowledge' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Knowledge sources" tooltip="Knowledge sources used by the agent to generate responses" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowKnowledgeSourcesPanel(true)}>See details</CopilotButton>
            </div>
            <KnowledgeSourcesGrid />
          </div>
        </section>

        {/* ───── Topic Cards ───── */}
        <section className="mb-2.5" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <SectionHeader title="Topics" tooltip="Most active conversation topics handled by the declarative agent, ranked by session volume" />
            <CopilotButton variant="outline" size="xs">See all topics</CopilotButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {MOCK_TOPICS.slice(0, 3).map((topic) => {
              const resColor = topic.resolution >= 85 ? COLORS.successText : topic.resolution >= 70 ? COLORS.warning : COLORS.danger
              return (
                <div
                  key={topic.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: `1px solid ${COLORS.strokeSubtle}`,
                    backgroundColor: COLORS.white,
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = COLORS.bgGridHeader}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = COLORS.white}
                  onClick={() => onTopicClick && onTopicClick(topic)}
                >
                  {/* Topic name + trend */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{topic.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      {topic.trend.up
                        ? <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                        : <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                      }
                      <span className="text-xs font-semibold" style={{ color: topic.trend.up ? COLORS.successText : COLORS.dangerText }}>
                        {topic.trend.pct}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <span className="text-xs block" style={{ color: COLORS.textSubtle, marginBottom: '12px' }}>{topic.description}</span>

                  {/* KPI row */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <Tooltip content={`${topic.sessions.toLocaleString()} sessions in the selected period`} relationship="description">
                      <div>
                        <span className="text-base font-normal block" style={{ color: COLORS.textPrimary }}>{topic.sessions.toLocaleString()}</span>
                        <span className="text-[10px]" style={{ color: COLORS.textSubtle }}>Sessions</span>
                      </div>
                    </Tooltip>
                    <Tooltip content={`${topic.resolution}% of sessions resolved successfully`} relationship="description">
                      <div>
                        <span className="text-base font-normal block" style={{ color: resColor }}>{topic.resolution}%</span>
                        <span className="text-[10px]" style={{ color: COLORS.textSubtle }}>Resolution</span>
                      </div>
                    </Tooltip>
                    <Tooltip content={`Average session duration for this topic`} relationship="description">
                      <div>
                        <span className="text-base font-normal block" style={{ color: COLORS.textPrimary }}>{topic.avgDuration}</span>
                        <span className="text-[10px]" style={{ color: COLORS.textSubtle }}>Avg duration</span>
                      </div>
                    </Tooltip>
                  </div>

                  {/* Top questions preview */}
                  <div style={{ borderTop: `1px solid ${COLORS.strokeSubtle}`, paddingTop: '8px' }}>
                    <span className="text-[10px] font-semibold block" style={{ color: COLORS.textSubtle, marginBottom: '2px' }}>Top questions</span>
                    {topic.topQuestions.slice(0, 2).map((q, i) => (
                      <span key={i} className="text-xs block" style={{ color: COLORS.textSecondary }}>{q}</span>
                    ))}
                    {topic.topQuestions.length > 2 && (
                      <span className="text-[10px]" style={{ color: '#0F6CBD' }}>+{topic.topQuestions.length - 2} more</span>
                    )}
                  </div>

                  {/* See details link */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <CopilotButton
                      variant="ghost"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); onTopicClick && onTopicClick(topic) }}
                    >
                      See details
                      <ChevronRight16Regular />
                    </CopilotButton>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div></div>
    </div>
  )
}

export default DeclarativeAgentPage
