import React, { useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
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
} from '@fluentui/react-icons'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { COLORS, CLS } from '../constants'
import { buildOutcomeChartOptions, buildAnswerQualityChartOptions, lineChartBase, TOOL_USE_SERIES, TRIGGER_USE_SERIES, AGENT_CLICK_EVALUATION, type QuestionsEvaluation } from '../chartHelpers'
import { EvaluationsGrid, AgentsGrid, KnowledgeSourcesGrid } from './Grids'
import { SectionHeader, AISummaryCard, OverviewKPICard, KPIItem, PillSwitcher } from './SharedComponents'
import type { Evaluation, Agent } from '../types'

interface HybridAgentPageProps {
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
  setShowOutcomesPanel: (show: boolean) => void
  setShowRunOutcomesPanel: (show: boolean) => void
  setShowKnowledgeSourcesPanel: (show: boolean) => void
  setShowTriggerUsePanel: (show: boolean) => void
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
  questionsEvaluation: Evaluation | null
  mockAgents: Agent[]
  onShowMetrics: (item: Evaluation) => void
  onEvaluate: (item: Evaluation) => void
}

function HybridAgentPage({
  timeRange, setTimeRange, setIsCustomDateDialogOpen,
  customStartDate, customEndDate,
  suggestionsExpanded, setSuggestionsExpanded,
  showSuggestionSkeleton,
  // Panel openers
  setShowActiveUsersPanel,
  setShowBillingPanel,
  setShowOutcomesPanel,
  setShowRunOutcomesPanel,
  setShowKnowledgeSourcesPanel,
  setShowTriggerUsePanel,
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
  // Navigation
  handleSeeSessions,
  handleEvaluationClick,
  questionsEvaluation,
  mockAgents,
  onShowMetrics,
  onEvaluate,
}: HybridAgentPageProps) {
  const [hybridFilter, setHybridFilter] = useState('all')
  const [bottomTab, setBottomTab] = useState('knowledge')

  return (
    <div className={CLS.pageRoot}>
      <div className={CLS.pageInner}><div className="max-w-full mx-auto">

        {/* AI Summary Section */}
        <AISummaryCard
          expanded={suggestionsExpanded}
          setExpanded={setSuggestionsExpanded}
          showSkeleton={showSuggestionSkeleton}
          collapsedText="Session volume is steady with 78% engagement. Run success rate at 94%."
        >
          <li>Your hybrid agent handles both conversations and autonomous runs. Session volume is steady with a 78% engagement rate.</li>
          <li>Autonomous run success rate is at 94% with average duration of 4.2s, while conversation outcomes show strong resolution trends.</li>
          <li>Copilot credit usage increased by 8%. Consider optimizing conversation flows to reduce unnecessary API calls.</li>
          <li>Time savings reached 387 hours this period, demonstrating strong automation value across both modes.</li>
          <li>Focus on auto themes showing lower response quality to improve overall outcomes.</li>
        </AISummaryCard>

        {/* Overview Cards - Three Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px', alignItems: 'stretch' }}>
          {/* Overview Card — Hybrid KPIs (2 rows of 3) */}
          <OverviewKPICard
            title="Overview"
            tooltip="Key performance metrics including conversation sessions, engagement rate, reactions, and daily active users"
            actionLabel="See active users"
            onAction={() => setShowActiveUsersPanel(true)}
            rows={[
              [
                { value: '20,356', label: 'Conversation sessions', trend: { pct: '5%', up: false } },
                { value: '78%', label: 'Engagement', trend: { pct: '5%', up: true } },
                { value: '569', label: 'Reactions', trend: { pct: '5%', up: true } },
              ],
              [
                { value: '1,284', label: 'Runs', trend: { pct: '12%', up: true } },
                { value: '94%', label: 'Successful Runs', trend: { pct: '3%', up: true } },
                { value: '4.2s', label: 'Average duration', trend: { pct: '7%', up: false } },
              ],
            ]}
          />

          {/* Billing Card */}
          <OverviewKPICard
            title="Billing"
            tooltip="Copilot credits consumed during the selected time period"
            actionLabel="See billing"
            onAction={() => setShowBillingPanel(true)}
            kpis={[
              { value: '12,450', label: 'Copilot credits used', trend: { pct: '8%', up: true } },
            ]}
          />

          {/* Savings Card */}
          <OverviewKPICard
            title="Savings"
            tooltip="Estimated time and cost savings from automated agent interactions"
            rows={[
              [
                { value: '387 hrs', label: 'Time', trend: { pct: '5%', up: true } },
                { value: '$12,771', label: 'Cost', trend: { pct: '8%', up: true } },
              ],
            ]}
          >
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  aria-label="More options"
                  className={CLS.ghostBtn}
                  style={{ minWidth: '32px', width: '32px', height: '32px' }}
                >
                  <MoreHorizontal20Regular />
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

        {/* ───── Filter Toggle: Conversations | Runs | All ───── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Session analytics</label>
          <PillSwitcher
            options={[{ key: 'conversations', label: 'Conversations' }, { key: 'runs', label: 'Runs' }, { key: 'all', label: 'All' }]}
            value={hybridFilter}
            onChange={setHybridFilter}
          />
        </div>

        {/* ───── 1. Reactions + Customer Satisfaction ───── */}
        <div className="flex gap-2.5 mb-2.5" style={{ alignItems: 'stretch' }}>
          {/* Reactions Card — taller to span both satisfaction + sentiment */}
          <section style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div className={CLS.card} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between p-3 pb-0">
                <SectionHeader title="Reactions" tooltip="User feedback reactions including thumbs up, thumbs down, and other responses" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tooltip content="See user comments" relationship="description">
                    <CopilotButton aria-label="View user comments" variant="icon-subtle" size="xs" onClick={() => handleEvaluationClick({ id: 'comments', name: 'Comments', evaluatedItem: { type: 'auto', name: 'Comments', icon: '/Sparkle.svg' }, dataType: 'Theme', categories: [], detailMode: 'comments' })}>
                      <Comment16Regular />
                    </CopilotButton>
                  </Tooltip>
                  <CopilotButton variant="outline" size="xs" onClick={() => setShowReactionsPanel(true)}>See details</CopilotButton>
                </div>
              </div>
              {/* KPIs + Donut — side by side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px 10px' }}>
                {/* KPIs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                  <KPIItem value="75%" trend="5%" trendUp={true} label="Thumbs up" />
                  <KPIItem value="25%" trend="5%" trendUp={false} label="Thumbs down" />
                </div>
                {/* Donut with callouts */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
          <section style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div className={CLS.card} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between p-3 pb-0">
                <SectionHeader title="Customer satisfaction" tooltip="Average satisfaction score from post-session CSAT surveys" />
                <CopilotButton variant="outline" size="xs" onClick={() => setShowSatisfactionPanel(true)}>See details</CopilotButton>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 14px 10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                    <span className="text-lg text-gray-900" style={{ fontWeight: '400', color: COLORS.textPrimary }}>3.2</span>
                    <span className="text-xs text-gray-500" style={{ color: COLORS.textTertiary }}>/5.0</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                      <ArrowUp16Regular style={{ width: '12px', height: '12px', color: COLORS.successText }} />
                      <span className="text-[11px]" style={{ fontWeight: '600', color: COLORS.successText }}>5%</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Satisfaction score for 345 surveys</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Satisfaction by session</span>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden' }}>
                    <Tooltip content="Dissatisfied: 25%" relationship="label" positioning="above">
                      <div style={{ width: '25%', backgroundColor: COLORS.chartPink, borderRadius: '6px 0 0 6px', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                    <Tooltip content="Neutral: 30%" relationship="label" positioning="above">
                      <div style={{ width: '30%', backgroundColor: 'rgba(0,0,0,0.09)', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                    <Tooltip content="Satisfied: 45%" relationship="label" positioning="above">
                      <div style={{ width: '45%', backgroundColor: COLORS.chartBlue, borderRadius: '0 6px 6px 0', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { label: 'Dissatisfied', pct: '25%', color: COLORS.chartPink },
                      { label: 'Neutral', pct: '30%', color: 'rgba(0,0,0,0.09)' },
                      { label: 'Satisfied', pct: '45%', color: COLORS.chartBlue },
                    ].map(seg => (
                      <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: seg.color, flexShrink: 0 }} />
                        <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>{seg.label}</span>
                        <span className="text-[11px]" style={{ fontWeight: '600' }}>{seg.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sentiment Card */}
          <section style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div className={CLS.card} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between p-3 pb-0">
                <SectionHeader title="Sentiment" tooltip="AI-powered analysis of user sentiment across all sessions" />
                <CopilotButton variant="outline" size="xs" onClick={() => setShowSentimentPanel(true)}>See details</CopilotButton>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 14px 10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
                    <span className="text-lg text-gray-900" style={{ fontWeight: '400', color: COLORS.textPrimary }}>60%</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                      <ArrowDown16Regular style={{ width: '12px', height: '12px', color: COLORS.dangerText }} />
                      <span className="text-[11px]" style={{ fontWeight: '600', color: COLORS.dangerText }}>2%</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Sessions with negative sentiment</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Sentiment</span>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden' }}>
                    <Tooltip content="Negative: 18%" relationship="label" positioning="above">
                      <div style={{ width: '18%', backgroundColor: COLORS.chartRed, borderRadius: '6px 0 0 6px', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                    <Tooltip content="Neutral: 20%" relationship="label" positioning="above">
                      <div style={{ width: '20%', backgroundColor: 'rgba(0,0,0,0.09)', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                    <Tooltip content="Positive: 62%" relationship="label" positioning="above">
                      <div style={{ width: '62%', backgroundColor: COLORS.chartGreen, borderRadius: '0 6px 6px 0', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { label: 'Negative', pct: '18%', color: COLORS.chartRed },
                      { label: 'Neutral', pct: '20%', color: 'rgba(0,0,0,0.09)' },
                      { label: 'Positive', pct: '62%', color: COLORS.chartGreen },
                    ].map(seg => (
                      <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: seg.color, flexShrink: 0 }} />
                        <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>{seg.label}</span>
                        <span className="text-[11px]" style={{ fontWeight: '600' }}>{seg.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <span className="text-[10px]" style={{ color: COLORS.textDisabled, padding: '0 14px 8px' }}>AI-generated content may be incorrect</span>
            </div>
          </section>
        </div>

        {/* ───── Conversation outcomes + Run outcomes (side by side) ───── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          {/* Conversation outcomes */}
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Conversation outcomes" tooltip="Distribution of conversation results: resolved, escalated, abandoned, and unresolved" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CopilotButton variant="outline" size="xs" onClick={() => setShowOutcomesPanel(true)}>See details</CopilotButton>
                <CopilotButton variant="outline" size="xs" onClick={handleSeeSessions}>See sessions</CopilotButton>
              </div>
            </div>
            <div style={{ height: 'auto' }}>
              <HighchartsReact
                highcharts={Highcharts}
                containerProps={{ style: { height: '100%' } }}
                options={buildOutcomeChartOptions({ timeRange, customStartDate, customEndDate, seed: 42 })}
              />
            </div>
          </div>

          {/* Run outcomes */}
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Run outcomes" tooltip="Distribution of run results: resolved, escalated, abandoned, and unresolved" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowRunOutcomesPanel(true)}>See details</CopilotButton>
            </div>
            <div style={{ height: 'auto' }}>
              <HighchartsReact
                highcharts={Highcharts}
                containerProps={{ style: { height: '100%' } }}
                options={buildOutcomeChartOptions({ timeRange, customStartDate, customEndDate, seed: 99 })}
              />
            </div>
          </div>
        </div>

        {/* ───── 3. Themes Grid ───── */}
        <section className="mb-2.5">
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="text-sm font-semibold text-gray-500">Themes</span>
                <PillSwitcher compact options={[{ key: 'all', label: 'All' }, { key: 'tracked', label: 'Tracked' }, { key: 'auto', label: 'Suggested' }]} value={themeFilter} onChange={setThemeFilter} />
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

        {/* ───── Generated answer rate and quality (full width) ───── */}
        <div style={{ marginBottom: '10px' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Generated answer rate and quality" tooltip="Percentage of questions answered by the agent and the quality of generated responses" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CopilotButton variant="outline" size="xs" onClick={() => setShowAnswerRatePanel(true)}>See details</CopilotButton>
                <CopilotButton variant="outline" size="xs" onClick={() => questionsEvaluation && handleEvaluationClick(questionsEvaluation)}>See questions</CopilotButton>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '0 14px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '160px' }}>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">712</span>
                  <span className="text-xs text-gray-500">Total questions</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">78%</span>
                  <span className="text-xs text-gray-500">Answered questions</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">22%</span>
                  <span className="text-xs text-gray-500">Unanswered questions</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Quality of generated answers</span>
                <div style={{ position: 'relative' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="text-sm font-semibold text-gray-500">Capabilities used</span>
            <PillSwitcher compact options={[{ key: 'knowledge', label: 'Knowledge' }, { key: 'tools', label: 'Tools' }, { key: 'triggers', label: 'Triggers' }, { key: 'agents', label: 'Agents' }]} value={bottomTab} onChange={setBottomTab} />
          </div>
        </section>

        {/* ───── 5. Knowledge Sources ───── */}
        <section className="mb-2.5" style={{ display: bottomTab === 'knowledge' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Knowledge sources" tooltip="Knowledge sources used by the agent to generate responses" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowKnowledgeSourcesPanel(true)}>See details</CopilotButton>
            </div>
            <KnowledgeSourcesGrid />
          </div>
        </section>

        {/* ───── 6. Trigger Use ───── */}
        <section className="mb-2.5" style={{ display: bottomTab === 'triggers' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Trigger use" tooltip="Frequency and distribution of triggers that initiate agent runs" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowTriggerUsePanel(true)}>See details</CopilotButton>
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '0 14px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">1,284</span>
                  <span className="text-xs text-gray-500">Total triggers</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">89%</span>
                  <span className="text-xs text-gray-500">Success rate</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Top triggers used</span>
                <HighchartsReact highcharts={Highcharts} options={{ ...lineChartBase, series: TRIGGER_USE_SERIES }} />
              </div>
            </div>
          </div>
        </section>

        {/* ───── 7. Tool Use ───── */}
        <section className="mb-2.5" style={{ display: bottomTab === 'tools' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
              <SectionHeader title="Tool use" tooltip="Tools invoked by the agent and their success rates" />
              <CopilotButton variant="outline" size="xs" onClick={() => setShowToolUsePanel(true)}>See details</CopilotButton>
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '0 14px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">756</span>
                  <span className="text-xs text-gray-500">Total tool use</span>
                </div>
                <div>
                  <span className="text-lg font-normal text-gray-900 block">95%</span>
                  <span className="text-xs text-gray-500">Success rate</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Top tools used</span>
                <HighchartsReact highcharts={Highcharts} options={{ ...lineChartBase, series: TOOL_USE_SERIES }} />
              </div>
            </div>
          </div>
        </section>

        {/* ───── 8. Agents ───── */}
        <section className="mb-2.5" style={{ display: bottomTab === 'agents' ? undefined : 'none' }}>
          <div className={CLS.card}>
            <div className="flex items-center justify-between p-3 pb-0">
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

      </div></div>
    </div>
  )
}

export default HybridAgentPage
