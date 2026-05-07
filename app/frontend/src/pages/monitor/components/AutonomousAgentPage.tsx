import React, { useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components'
import { MoreHorizontal20Regular } from '@fluentui/react-icons'
import { COLORS, CLS } from '../constants'
import { buildOutcomeChartOptions, lineChartBase, TOOL_USE_SERIES, TRIGGER_USE_SERIES, AGENT_CLICK_EVALUATION } from '../chartHelpers'
import { AgentsGrid, KnowledgeSourcesGrid } from './Grids'
import {
  SectionHeader,
  ChartCard,
  AISummaryCard,
  OverviewKPICard,
  KPIItem,
  PillSwitcher,
} from './SharedComponents'
import type { Evaluation, Agent } from '../types'

const OVERVIEW_KPIS = [
  { value: '1,284', label: 'Runs', trend: { pct: '12%', up: true } },
  { value: '94%', label: 'Successful runs', trend: { pct: '3%', up: true } },
  { value: '4.2s', label: 'Average duration', trend: { pct: '8%', up: false } },
]

interface AutonomousAgentPageProps {
  timeRange: string
  setTimeRange: (value: string) => void
  setIsCustomDateDialogOpen: (open: boolean) => void
  customStartDate: Date
  customEndDate: Date
  suggestionsExpanded: boolean
  setSuggestionsExpanded: (expanded: boolean) => void
  showSuggestionSkeleton: boolean
  setShowBillingPanel: (show: boolean) => void
  setShowOutcomesPanel: (show: boolean) => void
  setShowRunOutcomesPanel: (show: boolean) => void
  setShowKnowledgeSourcesPanel: (show: boolean) => void
  setShowTriggerUsePanel: (show: boolean) => void
  setShowToolUsePanel: (show: boolean) => void
  handleEvaluationClick: (evaluation: Evaluation) => void
  mockAgents: Agent[]
}

function AutonomousAgentPage({
  timeRange, setTimeRange, setIsCustomDateDialogOpen,
  customStartDate, customEndDate,
  suggestionsExpanded, setSuggestionsExpanded,
  showSuggestionSkeleton,
  // Panel openers
  setShowBillingPanel,
  setShowOutcomesPanel,
  setShowRunOutcomesPanel,
  setShowKnowledgeSourcesPanel,
  setShowTriggerUsePanel,
  setShowToolUsePanel,
  // Agents
  handleEvaluationClick,
  mockAgents,
}: AutonomousAgentPageProps) {
  const [bottomTab, setBottomTab] = useState('knowledge')
  // Knowledge tab shows grid only
  return (
    <div className={CLS.pageRoot}>
      <div className={CLS.pageInner}><div className="max-w-full mx-auto">

        {/* AI Summary Section */}
        <AISummaryCard
          expanded={suggestionsExpanded}
          setExpanded={setSuggestionsExpanded}
          showSkeleton={showSuggestionSkeleton}
          collapsedText="Autonomous runs increased by 12%. Success rate remains high at 94%."
        >
          <li>Your autonomous runs have increased by 12% compared to last week. Success rate remains high at 94%.</li>
          <li>Average run duration decreased to 4.2s, indicating improved processing efficiency.</li>
          <li>Copilot credit usage increased by 8%. Consider optimizing conversation flows to reduce unnecessary API calls.</li>
          <li>Time savings reached 387 hours this period, demonstrating strong automation value. Track trends for ROI reporting.</li>
          <li>Focus on auto themes showing lower response quality to improve overall conversation outcomes.</li>
        </AISummaryCard>

        {/* Overview Cards - Three Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          {/* Overview Card — Autonomous KPIs */}
          <OverviewKPICard
            title="Overview"
            tooltip="Key performance metrics including total runs, success rate, and average duration"
            kpis={OVERVIEW_KPIS}
          />

          {/* Billing Card */}
          <OverviewKPICard
            title="Billing"
            tooltip="Copilot credits consumed during the selected time period"
            kpis={[{ value: '12,450', label: 'Copilot credits used', trend: { pct: '8%', up: true } }]}
            actionLabel="See billing"
            onAction={() => setShowBillingPanel(true)}
          />

          {/* Savings Card */}
          <OverviewKPICard
            title="Savings"
            tooltip="Estimated time and cost savings from automated agent runs"
            kpis={[
              { value: '387 hrs', label: 'Time', trend: { pct: '5%', up: true } },
              { value: '$12,771', label: 'Cost', trend: { pct: '8%', up: true } },
            ]}
          >
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  className={CLS.ghostBtn}
                  style={{ minWidth: '32px', width: '32px', height: '32px' }}
                  aria-label="More options"
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

        {/* Run Outcomes Chart */}
        <ChartCard
          title="Run outcomes"
          tooltip="Distribution of run results: resolved, escalated, abandoned, and unresolved"
          actionLabel="See details"
          onAction={() => setShowRunOutcomesPanel(true)}
          style={{ marginBottom: '10px' }}
        >
          <HighchartsReact
            highcharts={Highcharts}
            containerProps={{ style: { height: '100%' } }}
            options={buildOutcomeChartOptions({ timeRange, customStartDate, customEndDate, seed: 42 })}
          />
        </ChartCard>

        {/* Capabilities used */}
        <section className="mb-2.5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="text-sm text-gray-500" style={{ fontWeight: '600' }}>Capabilities used</span>
            <PillSwitcher options={[{ key: 'knowledge', label: 'Knowledge' }, { key: 'tools', label: 'Tools' }, { key: 'triggers', label: 'Triggers' }, { key: 'agents', label: 'Agents' }]} value={bottomTab} onChange={setBottomTab} />
          </div>
        </section>

        {/* Trigger Use Section */}
        <section className="mb-2.5" style={{ display: bottomTab === 'triggers' ? undefined : 'none' }}>
          <ChartCard
            title="Trigger use"
            tooltip="Frequency and distribution of triggers that initiate agent runs"
            actionLabel="See details"
            onAction={() => setShowTriggerUsePanel(true)}
            headerStyle={{ paddingBottom: '8px', minHeight: '48px' }}
          >
            <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <KPIItem value="1,284" label="Total triggers" />
                <KPIItem value="89%" label="Success rate" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Top triggers used</span>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={{ ...lineChartBase, series: TRIGGER_USE_SERIES }}
                />
              </div>
            </div>
          </ChartCard>
        </section>

        {/* Knowledge Sources Section */}
        <section className="mb-2.5" style={{ display: bottomTab === 'knowledge' ? undefined : 'none' }}>
          <ChartCard
            title="Knowledge sources"
            tooltip="Knowledge sources used by the agent to generate responses"
            actionLabel="See details"
            onAction={() => setShowKnowledgeSourcesPanel(true)}
            headerStyle={{ paddingBottom: '8px', minHeight: '48px' }}
          >
            <KnowledgeSourcesGrid />
          </ChartCard>
        </section>

        {/* Tool Use Section */}
        <section className="mb-2.5" style={{ display: bottomTab === 'tools' ? undefined : 'none' }}>
          <ChartCard
            title="Tool use"
            tooltip="Tools invoked by the agent and their success rates"
            actionLabel="See details"
            onAction={() => setShowToolUsePanel(true)}
            headerStyle={{ paddingBottom: '8px', minHeight: '48px' }}
          >
            <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0, minWidth: '120px' }}>
                <KPIItem value="756" label="Total tool use" />
                <KPIItem value="95%" label="Success rate" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>Top tools used</span>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={{ ...lineChartBase, series: TOOL_USE_SERIES }}
                />
              </div>
            </div>
          </ChartCard>
        </section>

        {/* Agents Section */}
        <section className="mb-2.5" style={{ display: bottomTab === 'agents' ? undefined : 'none' }}>
          <ChartCard title="Agents" headerStyle={{ paddingBottom: '8px', minHeight: '48px' }}>
            <AgentsGrid
              data={mockAgents}
              onAgentClick={(agent) => {
                handleEvaluationClick({ ...AGENT_CLICK_EVALUATION, name: agent.name })
              }}
            />
          </ChartCard>
        </section>

      </div></div>
    </div>
  )
}

export default AutonomousAgentPage
