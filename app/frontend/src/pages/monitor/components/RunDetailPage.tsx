import React, { useState, useEffect } from 'react'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuGroupHeader,
  MenuDivider,
} from '@fluentui/react-components'
import {
  Filter20Regular,
  Checkmark20Regular,
  Share20Regular,
  ArrowDownload20Regular,
  MoreHorizontal20Regular,
  Sparkle20Regular,
} from '@fluentui/react-icons'
import { getRunResults } from '../data/mockData'
import { COLORS, CLS } from '../constants'
import { DetailPageHeader, FilterMenu } from './SharedComponents'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import type { EvaluationRun, Evaluation } from '../types'

type ScoreBand = 'green' | 'lightGreen' | 'yellow' | 'orange' | 'red'

interface ActiveFilter {
  type: string
  value?: string
  method?: string
}

const SCORE_BADGE_COLORS: Record<ScoreBand, { bg: string }> = {
  green: { bg: COLORS.successBg },
  lightGreen: { bg: 'rgba(140, 195, 83, 0.1)' },
  yellow: { bg: 'rgba(253, 227, 0, 0.1)' },
  orange: { bg: 'rgba(247, 99, 12, 0.1)' },
  red: { bg: COLORS.dangerBg },
}

const SCORE_PERCENTAGE_COLORS: Record<ScoreBand, string> = {
  green: COLORS.scoreGreen,
  lightGreen: COLORS.scoreLightGreen,
  yellow: COLORS.scoreYellow,
  orange: COLORS.scoreOrange,
  red: COLORS.scoreOrange,
}

function getScoreBand(percentage: number): ScoreBand {
  if (percentage < 20) return 'red'
  if (percentage < 40) return 'orange'
  if (percentage < 60) return 'yellow'
  if (percentage < 80) return 'lightGreen'
  return 'green'
}

function getInitials(name: string): string {
  if (!name) return ''
  const parts = name.split(' ')
  return parts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
}

interface RunDetailPageProps {
  run: EvaluationRun
  evaluation: Evaluation
  onBack: () => void
}

function RunDetailPage({ run, evaluation, onBack }: RunDetailPageProps) {
  const [agentVersion, setAgentVersion] = useState('Current draft')
  const [filters, setFilters] = useState<ActiveFilter[]>([])
  const [showSuggestionSkeleton, setShowSuggestionSkeleton] = useState(true)
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSuggestionSkeleton(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!run || !evaluation) {
    return null
  }

  const runResults = getRunResults(evaluation.id, run.id)

  if (!runResults || runResults.length === 0) {
    return (
      <div className={CLS.pageRoot}>
        <div className={`${CLS.pageInner} pt-2.5`}>
        <div className="max-w-full mx-auto">
          <DetailPageHeader title="Run not found" onBack={onBack} />
        </div>
        </div>
      </div>
    )
  }

  const testMethods = (evaluation.testMethods ?? '').split(', ')

  const totalResponses = runResults.length
  const failedResponses = runResults.filter(result => {
    return Object.values(result.testScores).some(score => score === 'Fail')
  }).length

  const methodScores = testMethods
    .map(method => run.testMethodScores[method])
    .filter(score => score !== undefined)

  const totalScore = methodScores.reduce((sum, ms) => sum + ms.score, 0)
  const totalMaxScore = methodScores.reduce((sum, ms) => sum + ms.maxScore, 0)
  const overallPercentage = Math.round((totalScore / totalMaxScore) * 100)

  const overallBand = getScoreBand(overallPercentage)

  const testMethodPercentages: Record<string, number> = {}
  testMethods.forEach(method => {
    const methodScore = run.testMethodScores[method]
    if (methodScore) {
      testMethodPercentages[method] = Math.round((methodScore.score / methodScore.maxScore) * 100)
    }
  })

  const handleAddFilter = (filter: ActiveFilter) => {
    if (filter.type === 'pass' || filter.type === 'fail') {
      setFilters([filter])
      return
    }

    const exists = filters.some(f =>
      f.type === filter.type &&
      f.value === filter.value &&
      f.method === filter.method
    )

    if (exists) {
      handleRemoveFilter(filter)
    } else {
      let filteredList = filters.filter(f => f.type !== 'pass' && f.type !== 'fail')

      filteredList = filteredList.filter(f => f.method !== filter.method)

      setFilters([...filteredList, filter])
    }
  }

  const handleRemoveFilter = (filterToRemove: ActiveFilter) => {
    setFilters(filters.filter(f =>
      !(f.type === filterToRemove.type &&
        f.value === filterToRemove.value &&
        f.method === filterToRemove.method)
    ))
  }

  const handleClearAllFilters = () => {
    setFilters([])
  }

  const isFilterActive = (filterToCheck: ActiveFilter) => {
    return filters.some(f =>
      f.type === filterToCheck.type &&
      f.value === filterToCheck.value &&
      f.method === filterToCheck.method
    )
  }

  const filteredRunResults = runResults.filter(result => {
    if (filters.length === 0) return true

    return filters.every(filter => {
      if (filter.type === 'pass') {
        return Object.values(result.testScores).every(score => score === 'Pass')
      } else if (filter.type === 'fail') {
        return Object.values(result.testScores).some(score => score === 'Fail')
      } else if (filter.type === 'testMethod' && filter.method) {
        return result.testScores[filter.method] === filter.value
      }
      return true
    })
  })

  const avgLatency = Math.round(2000 + Math.random() * 2000)
  const totalTokens = Math.round(filteredRunResults.length * (150 + Math.random() * 100))
  const totalCredits = Math.round(totalTokens * 0.065)

  return (
    <div className={CLS.pageRoot}>
      <div className={`${CLS.pageInner} pt-2.5`}>
        <div className="max-w-full mx-auto">
        {/* Header */}
        <DetailPageHeader title={run.name} onBack={onBack}>
          <div className="flex items-center gap-1">
            <CopilotButton variant="icon-subtle" size="xs" aria-label="Share">
              <Share20Regular />
            </CopilotButton>
            <CopilotButton variant="icon-subtle" size="xs" aria-label="Download">
              <ArrowDownload20Regular />
            </CopilotButton>
            <CopilotButton variant="icon-subtle" size="xs" aria-label="More options">
              <MoreHorizontal20Regular />
            </CopilotButton>
          </div>
        </DetailPageHeader>
        <div className="mb-2.5" style={{ marginTop: '-4px' }}>

          {/* Tags Row */}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '10px' }}>
            {/* Agent Version */}
            <FilterMenu options={[{value:'Current draft',label:'Current draft'},{value:'Published version',label:'Published version'}]} value={agentVersion} onChange={setAgentVersion} label="Agent version" defaultValue="Current draft" />

            {/* User Profile */}
            <span className="inline-flex items-center gap-1 h-5 px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-white text-[8px] font-semibold">{getInitials(run.user.name)}</span>
              User profile: {run.user.name}
            </span>
          </div>
        </div>

        {/* Top Insights / Copilot Summary */}
        <div className="relative" style={{ marginBottom: '10px' }}>
            <div className="relative overflow-hidden rounded-xl border border-[rgba(0,0,0,0.06)] outline-none shadow-none" style={{ padding: '12px', minHeight: suggestionsExpanded ? '140px' : '72px' }}>
              <div className="flex gap-[10px] items-start relative z-[1]">
                <Sparkle20Regular className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0 relative">
                  {showSuggestionSkeleton ? (
                    <div className="flex flex-col gap-2">
                      <div className="animate-pulse bg-gray-200 rounded" style={{ width: '90%', height: '14px' }} />
                      <div className="animate-pulse bg-gray-200 rounded" style={{ width: '85%', height: '14px' }} />
                    </div>
                  ) : (
                    <ul className="m-0 pl-[21px] text-sm font-semibold leading-5 list-disc" style={{ color: COLORS.textPrimary } as React.CSSProperties}>
                      <li>Analyze failure patterns: Review the 8 failing cases to identify common input characteristics or response patterns.</li>
                      <li>Compare with baseline: Cross-reference current run results with previous high-performing runs to spot regressions.</li>
                      {suggestionsExpanded && (
                        <>
                          <li>Investigate test method impact: Focus on "Contains substring" failures which show the highest failure rate.</li>
                          <li>Review edge cases: Examine inputs where expected vs. actual responses diverge most significantly.</li>
                          <li>Track performance trends: Monitor latency metrics across failed cases to identify potential timeout issues.</li>
                        </>
                      )}
                    </ul>
                  )}
                </div>
              </div>
              {!suggestionsExpanded && <div className="absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none z-[1]" style={{ background: 'linear-gradient(to bottom, transparent 0%, #FFFFFF 100%)' }} />}
              <CopilotButton
                variant="outline"
                size="xs"
                className="absolute left-1/2 -translate-x-1/2 z-[2]"
                style={{ bottom: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.14)' }}
                onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
              >
                {suggestionsExpanded ? 'View less' : 'View more'}
              </CopilotButton>
            </div>
        </div>

        {/* Run overview */}
        <div className="flex flex-col gap-3" style={{ marginBottom: '10px' }}>
          <label className="text-sm font-semibold text-gray-900">Run overview</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'fit-content(100%) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
            gap: '10px',
          }}>
            {/* Overall score card */}
            <div style={{
              backgroundColor: SCORE_BADGE_COLORS[overallBand].bg,
              padding: '10px 14px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'row',
              gap: '8px',
              alignItems: 'baseline',
              position: 'relative',
              overflow: 'hidden',
              border: 'none',
            }}>
              <span style={{
                fontSize: '40px',
                fontWeight: '600',
                lineHeight: '52px',
                color: SCORE_PERCENTAGE_COLORS[overallBand],
              }}>
                {overallPercentage}%
              </span>
            </div>

            {/* Metrics card spanning 3 columns */}
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)]" style={{
              gridColumn: '2 / span 3',
              padding: '10px 14px',
            }}>
              <div className="flex gap-2.5 justify-between">
                {/* Responses */}
                <div className="flex-1 flex flex-col justify-center">
                  <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                    {totalResponses}
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Responses
                  </span>
                </div>

                {/* Failed responses */}
                <div className="flex-1 flex flex-col justify-center">
                  <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                    {failedResponses}
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Failed responses
                  </span>
                </div>

                {/* Avg. latency */}
                <div className="flex-1 flex flex-col justify-center">
                  <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                    {avgLatency}ms
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Avg. latency
                  </span>
                </div>

                {/* Tokens */}
                <div className="flex-1 flex flex-col justify-center">
                  <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                    {totalTokens}t
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Tokens
                  </span>
                </div>

                {/* Credits */}
                <div className="flex-1 flex flex-col justify-center">
                  <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                    {totalCredits}
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Credits
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Grid Section */}
        <section className={`${CLS.card} overflow-hidden`}>
          <div className="flex items-center justify-between p-3 pb-2 min-h-[48px]">
            <label className="text-sm font-semibold text-gray-900">Results</label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Clear all link */}
              {filters.length > 1 && (
                <CopilotButton
                  variant="transparent"
                  size="xs"
                  onClick={handleClearAllFilters}
                  className="text-[#0F6CBD] hover:underline"
                >
                  Clear all
                </CopilotButton>
              )}

              {/* Active filter tags */}
              {filters.map((filter, index) => {
                let label = ''
                if (filter.type === 'pass') {
                  label = 'Only pass'
                } else if (filter.type === 'fail') {
                  label = 'Only fail'
                } else if (filter.type === 'testMethod') {
                  label = `${filter.method}: ${filter.value}`
                }

                return (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 h-5 px-1.5 border border-[rgba(0,0,0,0.09)] rounded-full text-[11px] text-gray-500"
                  >
                    {label}
                    <CopilotButton
                      variant="ghost"
                      size="xs"
                      className="inline-flex items-center justify-center w-3 h-3 rounded-full text-gray-400 hover:text-gray-600 text-[10px] leading-none p-0"
                      onClick={() => handleRemoveFilter(filter)}
                      aria-label="Remove filter"
                    >
                      &times;
                    </CopilotButton>
                  </span>
                )
              })}

              {/* Filter menu */}
              <Menu>
                <MenuTrigger>
                  <button type="button" className={CLS.ghostBtn} style={{ width: '24px', height: '24px', padding: 0, justifyContent: 'center' }} aria-label="Filter results">
                    <Filter20Regular />
                  </button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuGroupHeader>Select filters</MenuGroupHeader>
                    <MenuItem
                      icon={isFilterActive({ type: 'pass' }) ? <Checkmark20Regular /> : <span style={{ width: '20px', display: 'inline-block' }} />}
                      onClick={() => handleAddFilter({ type: 'pass' })}
                    >
                      Only pass
                    </MenuItem>
                    <MenuItem
                      icon={isFilterActive({ type: 'fail' }) ? <Checkmark20Regular /> : <span style={{ width: '20px', display: 'inline-block' }} />}
                      onClick={() => handleAddFilter({ type: 'fail' })}
                    >
                      Only fail
                    </MenuItem>
                    <MenuDivider />
                    {testMethods.map((method, index) => (
                      <Menu key={index}>
                        <MenuTrigger>
                          <MenuItem>{method}</MenuItem>
                        </MenuTrigger>
                        <MenuPopover>
                          <MenuList>
                            <MenuItem
                              icon={isFilterActive({ type: 'testMethod', method, value: 'Pass' }) ? <Checkmark20Regular /> : <span style={{ width: '20px', display: 'inline-block' }} />}
                              onClick={() => handleAddFilter({ type: 'testMethod', method, value: 'Pass' })}
                            >
                              Pass
                            </MenuItem>
                            <MenuItem
                              icon={isFilterActive({ type: 'testMethod', method, value: 'Fail' }) ? <Checkmark20Regular /> : <span style={{ width: '20px', display: 'inline-block' }} />}
                              onClick={() => handleAddFilter({ type: 'testMethod', method, value: 'Fail' })}
                            >
                              Fail
                            </MenuItem>
                          </MenuList>
                        </MenuPopover>
                      </Menu>
                    ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-hidden">
            <div style={{ overflowX: 'overlay' }} data-hide-scrollbar="true">
              {/* Table Header */}
              <div className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center pl-4 pr-3 gap-3">
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: '0 0 48px', minWidth: '48px', maxWidth: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>#</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 2, minWidth: '200px' }}>Question</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 2, minWidth: '200px' }}>Agent response</div>
              {testMethods.map((method, index) => {
                const percentage = testMethodPercentages[method]
                const band = getScoreBand(percentage)

                return (
                  <div key={index} className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{
                    flex: 1,
                    minWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    overflow: 'hidden'
                  }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: '0 1 auto',
                      minWidth: 0
                    }}>
                      {method}
                    </span>
                    {percentage !== undefined && (
                      <span style={{
                        flexShrink: 0,
                        fontWeight: '600',
                        fontSize: '14px',
                        color: SCORE_PERCENTAGE_COLORS[band],
                      }}>
                        {percentage}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Table Rows */}
            {filteredRunResults.map((result, index) => (
              <div key={index} className="flex items-center bg-white min-h-[44px] pl-4 pr-3 border-b border-[rgba(0,0,0,0.06)] gap-3 hover:bg-[hsl(var(--surface-secondary))] last:border-b-0">
                {/* Case Number */}
                <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: '0 0 48px', minWidth: '48px', maxWidth: '48px', justifyContent: 'center' }}>
                  <span className="text-xs text-gray-500">{result.caseIndex + 1}</span>
                </div>

                {/* Question */}
                <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 2, minWidth: '200px' }}>
                  <span className="text-xs text-gray-500" style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {result.question}
                  </span>
                </div>

                {/* Agent Response */}
                <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 2, minWidth: '200px' }}>
                  <span className="text-xs text-gray-500" style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {result.agentResponse}
                  </span>
                </div>

                {/* Test Method Scores */}
                {testMethods.map((method, methodIndex) => {
                  const score = result.testScores[method]
                  const isPassed = score === 'Pass'

                  return (
                    <div key={methodIndex} className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1, minWidth: '120px' }}>
                      <span className={`inline-flex items-center h-5 px-2 rounded-md text-[11px] font-medium ${isPassed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {score}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}

export default RunDetailPage
