import React, { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { mockEvaluations, mockDatasets, mockAgents } from './data/mockData'
import type { Evaluation, EvaluationRun, CustomMetric, Dataset, Agent, KnowledgeSource, Session, Question } from './types'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
} from '@fluentui/react-components'
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '../../components/ui/Dialog'
import { CopilotButton } from '../../components/ui/CopilotButton'
import {
  Add16Regular,
  ArrowExportLtr16Regular,
  DocumentTable16Regular,
  DocumentPdf16Regular,
} from '@fluentui/react-icons'
import './MonitorApp.css'
import { COLORS } from './constants'
import ThemeDetailPage from './components/ThemeDetailPage'
import RunDetailPage from './components/RunDetailPage'
import DatasetDetailPage from './components/DatasetDetailPage'
import NewEvaluationWizard from './components/NewEvaluationWizard'
import EvaluatePage from './components/EvaluatePage'
import MockDataViewer from './components/MockDataViewer'
import AutonomousAgentPage from './components/AutonomousAgentPage'
import HybridAgentPage from './components/HybridAgentPage'
import DeclarativeAgentPage from './components/DeclarativeAgentPage'
import ConversationalAgentPage from './components/ConversationalAgentPage'
import { ActiveUsersPanel, BillingPanel, SatisfactionPanel, SentimentPanel, ReactionsPanel, AnswerRatePanel, OutcomesPanel, RunOutcomesPanel, TriggerUsePanel, KnowledgeSourcesPanel, ToolUsePanel, ThemeMetricsPanel, QuestionDetailPanel, SessionDetailPanel } from './components/SidePanel'
import KnowledgeSourceDetailPage from './components/KnowledgeSourceDetailPage'
import { TimeRangeMenu } from './components/SharedComponents'
import ThemeDialog from './components/ThemeDialog'
import SessionsPage from './components/SessionsPage'
import CustomMetricDialog from './components/CustomMetricDialog'

// ─── Export Helpers ──────────────────────────────────────────────────────────

function downloadCSV(evaluations: Evaluation[], customMetrics: CustomMetric[]) {
  const rows = [['Section', 'Metric', 'Value', 'Trend', 'Direction']]

  // Overview KPIs
  rows.push(['Overview', 'Conversation sessions', '20356', '5%', 'down'])
  rows.push(['Overview', 'Engagement', '78%', '5%', 'up'])
  rows.push(['Overview', 'Reactions', '569', '5%', 'up'])
  rows.push(['Overview', 'Average DAU', '289', '8%', 'up'])

  // Billing
  rows.push(['Billing', 'Copilot credits used', '12450', '8%', 'up'])

  // Savings
  rows.push(['Savings', 'Time', '387 hrs', '5%', 'up'])
  rows.push(['Savings', 'Cost', '$12771', '8%', 'up'])

  // Reactions
  rows.push(['Reactions', 'Thumbs up', '75%', '5%', 'up'])
  rows.push(['Reactions', 'Thumbs down', '25%', '5%', 'down'])

  // Customer satisfaction
  rows.push(['Customer Satisfaction', 'Score', '3.2/5.0', '5%', 'up'])
  rows.push(['Customer Satisfaction', 'Dissatisfied', '25%', '', ''])
  rows.push(['Customer Satisfaction', 'Neutral', '30%', '', ''])
  rows.push(['Customer Satisfaction', 'Satisfied', '45%', '', ''])

  // Sentiment
  rows.push(['Sentiment', 'Negative sentiment sessions', '60%', '2%', 'down'])
  rows.push(['Sentiment', 'Negative', '18%', '', ''])
  rows.push(['Sentiment', 'Neutral', '20%', '', ''])
  rows.push(['Sentiment', 'Positive', '62%', '', ''])

  // Answer quality
  rows.push(['Answer Quality', 'Total questions', '789', '', ''])
  rows.push(['Answer Quality', 'Answered questions', '78%', '', ''])
  rows.push(['Answer Quality', 'Unanswered questions', '22%', '', ''])

  // Tool use
  rows.push(['Tool Use', 'Total tool use', '756', '', ''])
  rows.push(['Tool Use', 'Success rate', '95%', '', ''])

  // Themes
  rows.push([])
  rows.push(['Theme Name', 'Type', 'Categories', 'Score', 'Total Test Cases'])
  evaluations.forEach(e => {
    rows.push([e.name, e.evaluatedItem?.name || '', (e.categories || []).join('; '), `${e.overallScore}/${e.maxScore}`, String(e.totalTestCases)])
  })

  // Custom metrics
  if (customMetrics.length > 0) {
    rows.push([])
    rows.push(['Custom Metric', 'Categories'])
    customMetrics.forEach(m => {
      const catNames = (m.categories || []).filter(c => c.description.trim()).map(c => c.description).join('; ')
      rows.push([m.metricName, catNames])
    })
  }

  const csvContent = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportPDF() {
  window.print()
}

export default function MonitorApp() {
  const [currentView, setCurrentView] = useState('home')
  const [agentType, setAgentType] = useState('Conversational agent')
  const elevate = true
  const setElevate = () => {}
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null)
  const [timeRange, setTimeRange] = useState('7days')
  const [isCustomDateDialogOpen, setIsCustomDateDialogOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(subDays(new Date(), 30))
  const [customEndDate, setCustomEndDate] = useState(new Date())
  const [showSuggestionSkeleton, setShowSuggestionSkeleton] = useState(true)
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false)
  const [evaluations, setEvaluations] = useState(mockEvaluations)

  useEffect(() => {
    const timer = setTimeout(() => setShowSuggestionSkeleton(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  const questionsEvaluation = {
    id: '1',
    name: 'Questions',
    evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
    dataType: 'Theme',
    description: 'All user questions with answer quality and response details.',
    categories: ['Quality', 'Analytics'],
    overallScore: 198,
    maxScore: 200,
    totalTestCases: 789,
    answeredQuestions: '78%',
    responseQuality: '34%',
    thumbsUp: 76,
    thumbsDown: 207,
    testMethods: 'General quality, Compare meaning',
    lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '5 minutes ago' },
    dataset: 'Home claims full set',
    hideOverview: true,
  }

  const [isCustomMetricDialogOpen, setIsCustomMetricDialogOpen] = useState(false)
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([])
  const [editingMetricIndex, setEditingMetricIndex] = useState<number | null>(null)
  const [deleteMetricIndex, setDeleteMetricIndex] = useState<number | null>(null)
  const [isAddThemeDialogOpen, setIsAddThemeDialogOpen] = useState(false)
  const [newThemeName, setNewThemeName] = useState('')
  const [newThemeDescription, setNewThemeDescription] = useState('')
  const [newThemeCategories, setNewThemeCategories] = useState<string[]>([])
  const [isEditThemeDialogOpen, setIsEditThemeDialogOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Evaluation | null>(null)
  const [editThemeName, setEditThemeName] = useState('')
  const [editThemeDescription, setEditThemeDescription] = useState('')
  const [editThemeCategories, setEditThemeCategories] = useState<string[]>([])
  const [themeFilter, setThemeFilter] = useState('all')
  // Single active panel — only one open at a time
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [themeMetricsItem, setThemeMetricsItem] = useState<Evaluation | null>(null)
  const [questionDetailItem, setQuestionDetailItem] = useState<Question | null>(null)
  const [questionDetailMode, setQuestionDetailMode] = useState('questions')
  const [sessionDetailItem, setSessionDetailItem] = useState<Session | null>(null)
  const [answerRateFilter, setAnswerRateFilter] = useState('all')
  const closePanel = () => { setActivePanel(null); setThemeMetricsItem(null); setQuestionDetailItem(null); setSessionDetailItem(null) }
  const setShowActiveUsersPanel = (v: boolean) => setActivePanel(v ? 'activeUsers' : null)
  const setShowBillingPanel = (v: boolean) => setActivePanel(v ? 'billing' : null)
  const setShowSatisfactionPanel = (v: boolean) => setActivePanel(v ? 'satisfaction' : null)
  const setShowSentimentPanel = (v: boolean) => setActivePanel(v ? 'sentiment' : null)
  const setShowReactionsPanel = (v: boolean) => setActivePanel(v ? 'reactions' : null)
  const setShowAnswerRatePanel = (v: boolean) => setActivePanel(v ? 'answerRate' : null)
  const setShowOutcomesPanel = (v: boolean) => setActivePanel(v ? 'outcomes' : null)
  const setShowToolUsePanel = (v: boolean) => setActivePanel(v ? 'toolUse' : null)
  const setShowRunOutcomesPanel = (v: boolean) => setActivePanel(v ? 'runOutcomes' : null)
  const setShowKnowledgeSourcesPanel = (v: boolean) => setActivePanel(v ? 'knowledgeSources' : null)
  const setShowTriggerUsePanel = (v: boolean) => setActivePanel(v ? 'triggerUse' : null)
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState<KnowledgeSource | null>(null)
  const allExistingCategories = Array.from(new Set(evaluations.flatMap(e => e.categories || [])))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('mockdata')) {
      setCurrentView('mockdata')
    }
  }, [])
  const [navigationHistory, setNavigationHistory] = useState<{ view: string; dataset: Dataset | null; evaluation: Evaluation | null; run: EvaluationRun | null }[]>([])
  const [initialDatasetAgent, setInitialDatasetAgent] = useState<Agent | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentView])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePanel) closePanel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activePanel])

  const pushToHistory = useCallback(() => {
    setNavigationHistory(prev => [...prev, {
      view: currentView,
      dataset: selectedDataset,
      evaluation: selectedEvaluation,
      run: selectedRun
    }])
  }, [currentView, selectedDataset, selectedEvaluation, selectedRun])

  const handleKnowledgeSourceClick = useCallback((source: KnowledgeSource) => {
    closePanel()
    pushToHistory()
    setSelectedKnowledgeSource(source)
    setCurrentView('knowledge-source-detail')
  }, [pushToHistory])

  const handleDatasetClick = useCallback((dataset: Dataset, agent: Agent | null = null) => {
    closePanel()
    pushToHistory()
    setSelectedDataset(dataset)
    setInitialDatasetAgent(agent)
    setCurrentView('dataset-detail')
  }, [pushToHistory])

  const handleEvaluationClick = useCallback((evaluation: Evaluation) => {
    closePanel()
    pushToHistory()
    setSelectedEvaluation(evaluation)
    setCurrentView('evaluation-detail')
  }, [pushToHistory])

  // Global click handler for "See responses" button in Highcharts tooltip
  useEffect(() => {
    const handleTooltipClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action="see-responses"]')) {
        handleEvaluationClick({
          id: '1',
          name: 'Responses',
          evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
          dataType: 'Theme',
          categories: [],
          overallScore: 198,
          maxScore: 200,
          totalTestCases: 845,
          answeredQuestions: '78%',
          responseQuality: '34%',
          thumbsUp: 524,
          thumbsDown: 152,
          testMethods: 'General quality, Compare meaning',
          lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '5 minutes ago' },
          dataset: 'Home claims full set',
          detailMode: 'responses',
        })
      }
    }
    document.addEventListener('click', handleTooltipClick)
    return () => document.removeEventListener('click', handleTooltipClick)
  }, [handleEvaluationClick])

  const handleRunClick = useCallback((run: EvaluationRun) => {
    closePanel()
    pushToHistory()
    setSelectedRun(run)
    setCurrentView('run-detail')
  }, [pushToHistory])

  const handleSeeSessions = useCallback(() => {
    closePanel()
    pushToHistory()
    setCurrentView('sessions')
  }, [pushToHistory])

  const [evaluateItem, setEvaluateItem] = useState<Evaluation | null>(null)
  const handleEvaluate = useCallback((item: Evaluation) => {
    closePanel()
    pushToHistory()
    setEvaluateItem(item)
    setCurrentView('evaluate')
  }, [pushToHistory])

  const handleTrackTheme = useCallback((theme: Evaluation) => {
    setEvaluations(prevEvaluations =>
      prevEvaluations.map(evaluation =>
        evaluation.id === theme.id
          ? {
              ...evaluation,
              evaluatedItem: {
                ...evaluation.evaluatedItem,
                type: 'tracked',
                name: 'Tracked theme',
                icon: '/Target.svg'
              }
            }
          : evaluation
      )
    )
  }, [])

  const handleAddTheme = useCallback(() => {
    if (!newThemeName.trim()) return

    const newTheme = {
      id: String(evaluations.length + 1),
      name: newThemeName,
      evaluatedItem: { type: 'tracked', name: 'Tracked theme', icon: '/Target.svg' },
      dataType: 'Theme',
      categories: [...newThemeCategories],
      overallScore: 0,
      maxScore: 200,
      totalTestCases: 0,
      answeredQuestions: '0%',
      responseQuality: '0%',
      thumbsUp: 0,
      thumbsDown: 0,
      testMethods: '',
      lastRunBy: { name: 'System', avatar: '', time: 'Just now' },
      dataset: '',
    }

    setEvaluations(prev => [newTheme, ...prev])
    setIsAddThemeDialogOpen(false)
    setNewThemeName('')
    setNewThemeDescription('')
    setNewThemeCategories([])
  }, [newThemeName, newThemeCategories, evaluations.length])

  const handleOpenEditTheme = useCallback((theme: Evaluation) => {
    setEditingTheme(theme)
    setEditThemeName(theme.name)
    setEditThemeDescription('')
    setEditThemeCategories(theme.categories ? [...theme.categories] : [])
    setIsEditThemeDialogOpen(true)
  }, [])

  const handleSaveEditTheme = useCallback(() => {
    if (!editThemeName.trim() || !editingTheme) return

    setEvaluations(prevEvaluations =>
      prevEvaluations.map(evaluation =>
        evaluation.id === editingTheme.id
          ? {
              ...evaluation,
              name: editThemeName,
              evaluatedItem: { type: 'tracked', name: 'Tracked theme', icon: '/Target.svg' },
              categories: [...editThemeCategories],
            }
          : evaluation
      )
    )
    setIsEditThemeDialogOpen(false)
    setEditingTheme(null)
    setEditThemeName('')
    setEditThemeDescription('')
    setEditThemeCategories([])
  }, [editThemeName, editingTheme, editThemeCategories])

  const handleDeleteTheme = useCallback((themeId: string) => {
    setEvaluations(prev => prev.filter(e => e.id !== themeId))
  }, [])

  const handleBack = useCallback(() => {
    closePanel()
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1]
      setNavigationHistory(prev => prev.slice(0, -1))
      setCurrentView(previous.view)
      setSelectedDataset(previous.dataset)
      setSelectedEvaluation(previous.evaluation)
      setSelectedRun(previous.run)
      setInitialDatasetAgent(null)
      setSelectedKnowledgeSource(null)
    } else {
      setCurrentView('home')
      setSelectedDataset(null)
      setSelectedEvaluation(null)
      setSelectedRun(null)
      setInitialDatasetAgent(null)
      setSelectedKnowledgeSource(null)
    }
  }, [navigationHistory])

  useEffect(() => {
    const handleNavigateToDataset = (event: Event) => {
      const customEvent = event as CustomEvent<{ dataset: Dataset; agent: Agent | null }>
      handleDatasetClick(customEvent.detail.dataset, customEvent.detail.agent)
    }

    window.addEventListener('navigate-to-dataset', handleNavigateToDataset)
    return () => {
      window.removeEventListener('navigate-to-dataset', handleNavigateToDataset)
    }
  }, [handleDatasetClick])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        /* Custom calendar styling to match Figma design */
        .rdp {
          --rdp-accent-color: #0F6CBD;
          --rdp-background-color: #0F6CBD;
          --rdp-cell-size: 32px;
          --rdp-day-font: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;

          margin: 0;
          background: hsl(var(--background));
          border-radius: 4px;
          box-shadow: 0px 8px 16px ${COLORS.shadow}, 0px 0px 2px ${COLORS.shadow};
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          width: 248px;
        }

        /* Month caption (header) */
        .rdp-months {
          margin: 0;
        }

        .rdp-month {
          margin: 0;
          width: 248px;
        }

        .rdp-month_caption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 41px;
          padding: 0 12px;
          border-bottom: 1px solid rgba(0,0,0,0.09);
          background: hsl(var(--background));
          border-radius: 4px 4px 0 0;
          margin: 0;
        }

        .rdp-caption_label {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 16px;
          color: hsl(var(--text-primary));
          padding: 4px 8px;
          border-radius: 4px;
        }

        /* Navigation buttons */
        .rdp-nav {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .rdp-button_previous,
        .rdp-button_next {
          width: 16px;
          height: 16px;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rdp-button_previous:hover,
        .rdp-button_next:hover {
          background: hsl(var(--surface-secondary));
          border-radius: 4px;
        }

        .rdp-button_previous svg,
        .rdp-button_next svg {
          fill: hsl(var(--text-primary));
          color: hsl(var(--text-primary));
        }

        /* Calendar body */
        .rdp-month_grid {
          padding: 12px;
          margin: 0;
          width: 248px;
        }

        .rdp-weekdays {
          margin: 0;
        }

        /* Day headers (S M T W T F S) */
        .rdp-weekday {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          color: hsl(var(--text-disabled));
          text-transform: lowercase;
          width: 32px;
          height: 32px;
          padding: 0;
          text-align: center;
        }

        .rdp-weekdays th {
          font-weight: 400;
        }

        /* Day cells - remove outline/border */
        .rdp-day {
          width: 32px;
          height: 32px;
          padding: 0;
          margin: 0;
          border-radius: 50%;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 32px;
          color: hsl(var(--text-disabled));
          border: none;
          background: transparent;
          cursor: pointer;
          outline: none;
        }

        .rdp-day:hover:not(.rdp-day_disabled):not(.rdp-day_selected) {
          background: hsl(var(--surface-secondary));
          border-radius: 50%;
        }

        .rdp-day:focus-visible {
          outline: none;
        }

        /* Selected day - filled circle */
        .rdp-day_selected,
        .rdp-day_selected:focus,
        .rdp-day_selected:active {
          background: #0F6CBD !important;
          color: #FFFFFF !important;
          border-radius: 50% !important;
          font-weight: 400;
          border: none !important;
          outline: none !important;
        }

        .rdp-day_selected:hover {
          background: #115EA3 !important;
        }

        /* Disabled/outside month days */
        .rdp-day_disabled,
        .rdp-day_outside {
          color: hsl(var(--text-disabled));
          cursor: default;
        }

        .rdp-day_disabled:hover {
          background: transparent;
        }

        /* Today indicator (if needed) */
        .rdp-day_today:not(.rdp-day_selected) {
          font-weight: 600;
        }

        /* Remove any default focus rings */
        .rdp-button:focus,
        .rdp-day:focus {
          outline: none;
        }

        /* Remove padding from MenuPopover when it contains a calendar */
        .fui-MenuPopover:has(.rdp) {
          padding: 0;
        }

        /* Hide scrollbars by default, show on hover - overlay style to prevent layout shift */
        [data-hide-scrollbar="true"] {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }

        /* Webkit scrollbar - always defined but transparent when not hovering */
        [data-hide-scrollbar="true"]::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        [data-hide-scrollbar="true"]::-webkit-scrollbar-track {
          background: transparent;
        }

        [data-hide-scrollbar="true"]::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
        }

        /* Show scrollbar on hover */
        [data-hide-scrollbar="true"]:hover {
          scrollbar-width: thin; /* Firefox */
        }

        [data-hide-scrollbar="true"]:hover::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.09);
        }

        [data-hide-scrollbar="true"]:hover::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.06);
        }
      `}</style>
              {/* Canvas + Inline Side Panel */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div className="monitor-canvas-scroll" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }} onClick={(e) => {
                if (!activePanel) return
                const target = e.target as HTMLElement
                const tag = target.tagName?.toLowerCase()
                if (tag === 'button' || tag === 'a' || target.closest('button') || target.closest('a')) return
                closePanel()
              }}>
                {/* Page header — Monitor title + toolbar */}
                {currentView === 'home' && (
                  <div className="px-4 pt-2.5 pb-0 box-border flex-shrink-0">
                    <div className="max-w-full mx-auto">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-lg font-semibold text-gray-900">Monitor</span>
                        <div className="flex items-center gap-2">
                          <TimeRangeMenu timeRange={timeRange} setTimeRange={setTimeRange} onCustomClick={() => setIsCustomDateDialogOpen(true)} />
                          {agentType === 'Conversational agent' && (
                            <>
                              {customMetrics.length >= 3 ? (
                                <Tooltip content="Maximum of 3 custom metrics can be added" relationship="label" positioning="below">
                                  <span role="button" aria-disabled="true" tabIndex={0} className="inline-flex">
                                    <CopilotButton variant="outline" size="xs" disabled>
                                      <Add16Regular className="w-3.5 h-3.5" />Add custom metric
                                    </CopilotButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <CopilotButton variant="outline" size="xs" onClick={() => { setEditingMetricIndex(null); setIsCustomMetricDialogOpen(true) }}>
                                  <Add16Regular className="w-3.5 h-3.5" />Add custom metric
                                </CopilotButton>
                              )}
                              <Menu>
                                <MenuTrigger disableButtonEnhancement>
                                  <button type="button" className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-[hsl(var(--stroke-default))] bg-white text-xs text-gray-900 cursor-pointer hover:bg-gray-50 transition-colors">
                                    <ArrowExportLtr16Regular className="w-3.5 h-3.5" />Export
                                  </button>
                                </MenuTrigger>
                                <MenuPopover>
                                  <MenuList>
                                    <MenuItem icon={<DocumentTable16Regular />} onClick={() => downloadCSV(evaluations, customMetrics)}>Download as CSV</MenuItem>
                                    <MenuItem icon={<DocumentPdf16Regular />} onClick={exportPDF}>Download as PDF</MenuItem>
                                  </MenuList>
                                </MenuPopover>
                              </Menu>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentView === 'mockdata' ? (
                  <MockDataViewer />
                ) : currentView === 'home' && agentType === 'Autonomous agent' ? (
                  <AutonomousAgentPage
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    setIsCustomDateDialogOpen={setIsCustomDateDialogOpen}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    suggestionsExpanded={suggestionsExpanded}
                    setSuggestionsExpanded={setSuggestionsExpanded}
                    showSuggestionSkeleton={showSuggestionSkeleton}
                    setShowBillingPanel={setShowBillingPanel}
                    setShowOutcomesPanel={setShowOutcomesPanel}
                    setShowRunOutcomesPanel={setShowRunOutcomesPanel}
                    setShowKnowledgeSourcesPanel={setShowKnowledgeSourcesPanel}
                    setShowTriggerUsePanel={setShowTriggerUsePanel}
                    setShowToolUsePanel={setShowToolUsePanel}
                    handleEvaluationClick={handleEvaluationClick}
                    mockAgents={mockAgents}
                  />
                ) : currentView === 'home' && agentType === 'Hybrid agent' ? (
                  <HybridAgentPage
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    setIsCustomDateDialogOpen={setIsCustomDateDialogOpen}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    suggestionsExpanded={suggestionsExpanded}
                    setSuggestionsExpanded={setSuggestionsExpanded}
                    showSuggestionSkeleton={showSuggestionSkeleton}
                    setShowActiveUsersPanel={setShowActiveUsersPanel}
                    setShowBillingPanel={setShowBillingPanel}
                    setShowOutcomesPanel={setShowOutcomesPanel}
                    setShowRunOutcomesPanel={setShowRunOutcomesPanel}
                    setShowKnowledgeSourcesPanel={setShowKnowledgeSourcesPanel}
                    setShowTriggerUsePanel={setShowTriggerUsePanel}
                    setShowToolUsePanel={setShowToolUsePanel}
                    setShowReactionsPanel={setShowReactionsPanel}
                    setShowSatisfactionPanel={setShowSatisfactionPanel}
                    setShowSentimentPanel={setShowSentimentPanel}
                    setShowAnswerRatePanel={setShowAnswerRatePanel}
                    evaluations={evaluations}
                    themeFilter={themeFilter}
                    setThemeFilter={setThemeFilter}
                    setIsAddThemeDialogOpen={setIsAddThemeDialogOpen}
                    handleTrackTheme={handleTrackTheme}
                    handleOpenEditTheme={handleOpenEditTheme}
                    handleDeleteTheme={handleDeleteTheme}
                    handleSeeSessions={handleSeeSessions}
                    handleEvaluationClick={handleEvaluationClick}
                    questionsEvaluation={questionsEvaluation}
                    mockAgents={mockAgents}
                    onShowMetrics={(item: Evaluation) => { setActivePanel('themeMetrics'); setThemeMetricsItem(item) }}
                    onEvaluate={handleEvaluate}
                  />
                ) : currentView === 'home' && agentType === 'Declarative agent' ? (
                  <DeclarativeAgentPage
                    elevate={elevate}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    setIsCustomDateDialogOpen={setIsCustomDateDialogOpen}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    suggestionsExpanded={suggestionsExpanded}
                    setSuggestionsExpanded={setSuggestionsExpanded}
                    showSuggestionSkeleton={showSuggestionSkeleton}
                    setShowActiveUsersPanel={setShowActiveUsersPanel}
                    setShowBillingPanel={setShowBillingPanel}
                    setShowReactionsPanel={setShowReactionsPanel}
                    setShowSatisfactionPanel={setShowSatisfactionPanel}
                    setShowSentimentPanel={setShowSentimentPanel}
                    setShowAnswerRatePanel={setShowAnswerRatePanel}
                    setShowOutcomesPanel={setShowOutcomesPanel}
                    setShowKnowledgeSourcesPanel={setShowKnowledgeSourcesPanel}
                    setShowToolUsePanel={setShowToolUsePanel}
                    evaluations={evaluations}
                    themeFilter={themeFilter}
                    setThemeFilter={setThemeFilter}
                    setIsAddThemeDialogOpen={setIsAddThemeDialogOpen}
                    handleTrackTheme={handleTrackTheme}
                    handleOpenEditTheme={handleOpenEditTheme}
                    handleDeleteTheme={handleDeleteTheme}
                    handleSeeSessions={handleSeeSessions}
                    handleEvaluationClick={handleEvaluationClick}
                    questionsEvaluation={questionsEvaluation}
                    onShowMetrics={(item: Evaluation) => { setActivePanel('themeMetrics'); setThemeMetricsItem(item) }}
                    onEvaluate={handleEvaluate}
                    onTopicClick={(topic) => handleEvaluationClick({ id: topic.id, name: topic.name, evaluatedItem: { type: 'auto', name: topic.name, icon: '/Sparkle.svg' }, dataType: 'Topic', categories: [], detailMode: 'topic', topicData: topic })}
                  />
                ) : currentView === 'home' ? (
                  <ConversationalAgentPage
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    isCustomDateDialogOpen={isCustomDateDialogOpen}
                    setIsCustomDateDialogOpen={setIsCustomDateDialogOpen}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    setCustomStartDate={(date: Date | undefined) => setCustomStartDate(date ?? new Date())}
                    setCustomEndDate={(date: Date | undefined) => setCustomEndDate(date ?? new Date())}
                    suggestionsExpanded={suggestionsExpanded}
                    setSuggestionsExpanded={setSuggestionsExpanded}
                    showSuggestionSkeleton={showSuggestionSkeleton}
                    setShowActiveUsersPanel={setShowActiveUsersPanel}
                    setShowBillingPanel={setShowBillingPanel}
                    setShowOutcomesPanel={setShowOutcomesPanel}
                    setShowKnowledgeSourcesPanel={setShowKnowledgeSourcesPanel}
                    setShowToolUsePanel={setShowToolUsePanel}
                    setShowReactionsPanel={setShowReactionsPanel}
                    setShowSatisfactionPanel={setShowSatisfactionPanel}
                    setShowSentimentPanel={setShowSentimentPanel}
                    setShowAnswerRatePanel={setShowAnswerRatePanel}
                    evaluations={evaluations}
                    themeFilter={themeFilter}
                    setThemeFilter={setThemeFilter}
                    setIsAddThemeDialogOpen={setIsAddThemeDialogOpen}
                    handleTrackTheme={handleTrackTheme}
                    handleOpenEditTheme={handleOpenEditTheme}
                    handleDeleteTheme={handleDeleteTheme}
                    handleSeeSessions={handleSeeSessions}
                    handleEvaluationClick={handleEvaluationClick}
                    handleKnowledgeSourceClick={handleKnowledgeSourceClick}
                    questionsEvaluation={questionsEvaluation}
                    mockAgents={mockAgents}
                    onShowMetrics={(item: Evaluation) => { setActivePanel('themeMetrics'); setThemeMetricsItem(item) }}
                    onEvaluate={handleEvaluate}
                    customMetrics={customMetrics}
                    setEditingMetricIndex={setEditingMetricIndex}
                    setIsCustomMetricDialogOpen={setIsCustomMetricDialogOpen}
                    setDeleteMetricIndex={setDeleteMetricIndex}
                  />
              ) : currentView === 'dataset-detail' ? (
                <DatasetDetailPage
                  dataset={selectedDataset!}
                  onBack={handleBack}
                  initialAgent={initialDatasetAgent}
                />
              ) : currentView === 'evaluation-detail' ? (
                <ThemeDetailPage
                  evaluation={selectedEvaluation!}
                  onBack={handleBack}
                  onRunClick={handleRunClick}
                  mode={selectedEvaluation?.detailMode || 'questions'}
                  onQuestionSelect={(item) => { setActivePanel('questionDetail'); setQuestionDetailItem(item as unknown as Question); setQuestionDetailMode(selectedEvaluation?.detailMode || 'questions') }}
                />
              ) : currentView === 'run-detail' ? (
                <RunDetailPage
                  run={selectedRun!}
                  evaluation={selectedEvaluation!}
                  onBack={handleBack}
                />
              ) : currentView === 'create-evaluation' ? (
                <NewEvaluationWizard
                  onBack={handleBack}
                />
              ) : currentView === 'sessions' ? (
                <SessionsPage
                  onBack={handleBack}
                  onSessionSelect={(session) => { setActivePanel('sessionDetail'); setSessionDetailItem(session) }}
                />
              ) : currentView === 'evaluate' ? (
                <EvaluatePage
                  evaluation={evaluateItem!}
                  onBack={handleBack}
                />
              ) : currentView === 'knowledge-source-detail' ? (
                <KnowledgeSourceDetailPage
                  source={selectedKnowledgeSource!}
                  onBack={handleBack}
                  onQuestionSelect={(item: Question) => { setActivePanel('questionDetail'); setQuestionDetailItem(item); setQuestionDetailMode('questions') }}
                />
              ) : null}
            </div>

              {/* Inline Side Panel — only one at a time */}
              {activePanel === 'activeUsers' && <ActiveUsersPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'billing' && <BillingPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'satisfaction' && <SatisfactionPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'sentiment' && <SentimentPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'reactions' && <ReactionsPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'answerRate' && <AnswerRatePanel open onClose={closePanel} answerRateFilter={answerRateFilter} setAnswerRateFilter={setAnswerRateFilter} compact={elevate} />}
              {activePanel === 'outcomes' && <OutcomesPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'runOutcomes' && <RunOutcomesPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'knowledgeSources' && <KnowledgeSourcesPanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'triggerUse' && <TriggerUsePanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'toolUse' && <ToolUsePanel open onClose={closePanel} compact={elevate} />}
              {activePanel === 'themeMetrics' && <ThemeMetricsPanel open onClose={closePanel} theme={themeMetricsItem!} compact={elevate} />}
              {activePanel === 'questionDetail' && <QuestionDetailPanel key={questionDetailItem?.question} open onClose={closePanel} question={questionDetailItem!} mode={questionDetailMode} compact={elevate} />}
              {activePanel === 'sessionDetail' && <SessionDetailPanel key={sessionDetailItem?.id} open onClose={closePanel} session={sessionDetailItem!} compact={elevate} />}
            </div>

      {/* Theme Dialogs */}
      <ThemeDialog
        open={isAddThemeDialogOpen}
        onClose={() => setIsAddThemeDialogOpen(false)}
        title="Add theme"
        subtitle="We will automatically add questions for the theme"
        name={newThemeName}
        setName={setNewThemeName}
        description={newThemeDescription}
        setDescription={setNewThemeDescription}
        categories={newThemeCategories}
        setCategories={setNewThemeCategories}
        allExistingCategories={allExistingCategories}
        onSave={handleAddTheme}
        saveLabel="Create"
      />
      <ThemeDialog
        open={isEditThemeDialogOpen}
        onClose={() => setIsEditThemeDialogOpen(false)}
        title="Edit theme"
        subtitle="All questions remain assigned to the theme"
        name={editThemeName}
        setName={setEditThemeName}
        description={editThemeDescription}
        setDescription={setEditThemeDescription}
        categories={editThemeCategories}
        setCategories={setEditThemeCategories}
        allExistingCategories={allExistingCategories}
        onSave={handleSaveEditTheme}
        saveLabel="Save"
      />
      <CustomMetricDialog
        open={isCustomMetricDialogOpen}
        onClose={() => { setIsCustomMetricDialogOpen(false); setEditingMetricIndex(null) }}
        initialData={editingMetricIndex !== null ? customMetrics[editingMetricIndex] : undefined}
        onSave={(metric) => {
          if (editingMetricIndex !== null) {
            setCustomMetrics(prev => prev.map((m, i) => i === editingMetricIndex ? metric : m))
          } else if (customMetrics.length < 3) {
            setCustomMetrics([...customMetrics, metric])
          }
          setIsCustomMetricDialogOpen(false)
          setEditingMetricIndex(null)
        }}
      />

      {/* Delete custom metric confirmation */}
      <Dialog isOpen={deleteMetricIndex !== null} onClose={() => setDeleteMetricIndex(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDeleteMetricIndex(null)}>
          <DialogTitle>Delete custom metric</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-body-2 text-text-secondary">Are you sure you want to delete "{deleteMetricIndex !== null ? customMetrics[deleteMetricIndex]?.metricName : ''}"? This action cannot be undone.</p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" size="md" onClick={() => setDeleteMetricIndex(null)}>Cancel</CopilotButton>
          <CopilotButton variant="primary" size="md" className="bg-red-600 hover:bg-red-700" onClick={() => { setCustomMetrics(prev => prev.filter((_, idx) => idx !== deleteMetricIndex)); setDeleteMetricIndex(null) }}>Delete</CopilotButton>
        </DialogFooter>
      </Dialog>

    </div>
  )
}
