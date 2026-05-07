import { format } from 'date-fns'
import { COLORS, CHART_DEFAULTS } from './constants'

export interface ChartSeriesData {
  name: string
  type?: string
  color: string
  fillOpacity?: number
  data: [number, number][]
  stack?: string
}

export interface QuestionsEvaluation {
  initialQualityFilter?: string
  [key: string]: unknown
}

interface BuildOutcomeChartParams {
  timeRange: string
  customStartDate?: Date
  customEndDate?: Date
  seed?: number
}

interface BuildAnswerQualityChartParams {
  handleEvaluationClick: (evaluation: QuestionsEvaluation) => void
  questionsEvaluation: QuestionsEvaluation
}

// ─── Shared Legend Config ────────────────────────────────────────────────────
export const lineChartLegend = {
  enabled: true,
  layout: 'horizontal',
  align: 'center',
  verticalAlign: 'bottom',
  useHTML: true,
  symbolWidth: 0,
  symbolHeight: 0,
  symbolPadding: 0,
  labelFormatter: function(this: { color: string; name: string }): string {
    return '<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ' + this.color + ';"></span><span style="font-size: 12px; font-weight: 400; color: ' + COLORS.fg3 + ';">' + this.name + '</span></span>';
  },
  itemDistance: 16,
  margin: 8,
  padding: 0,
}

// ─── Shared Tooltip Config ───────────────────────────────────────────────────
export const lineChartTooltip = {
  shared: false,
  backgroundColor: '#FFFFFF',
  borderColor: COLORS.strokeSubtle,
  borderRadius: '12px',
  padding: 12,
  shadow: CHART_DEFAULTS.tooltip.shadow,
  style: { fontSize: '12px', color: COLORS.textPrimary },
}

// ─── Shared Plot Options ─────────────────────────────────────────────────────
export const lineChartPlotOptions = {
  line: {
    marker: {
      enabled: false,
      symbol: 'circle',
      states: {
        hover: { enabled: true, radius: 4 },
      },
    },
    lineWidth: 2,
  },
}

// ─── Line Chart Base Config ──────────────────────────────────────────────────
export const lineChartBase = {
  chart: { type: 'line', backgroundColor: 'transparent', height: 200 },
  title: { text: null },
  credits: { enabled: false },
  accessibility: { enabled: false },
  xAxis: {
    type: 'datetime',
    lineColor: 'rgba(0,0,0,0.09)',
    tickColor: 'rgba(0,0,0,0.09)',
    labels: { style: { color: COLORS.textSecondary, fontSize: '12px' } },
  },
  yAxis: {
    title: { text: null },
    gridLineColor: COLORS.strokeSubtle,
    labels: { style: { color: COLORS.textSecondary, fontSize: '12px' } },
  },
  legend: lineChartLegend,
  tooltip: lineChartTooltip,
  plotOptions: lineChartPlotOptions,
}

// ─── Outcome (Areaspline) Chart Builder ──────────────────────────────────────
export function buildOutcomeChartOptions({ timeRange, customStartDate, customEndDate, seed: seed0 = 42 }: BuildOutcomeChartParams): Record<string, unknown> {
  const now = new Date()
  const daysDiff = timeRange === '7days' ? 7 :
                   timeRange === '15days' ? 15 :
                   timeRange === '4weeks' ? 28 :
                   timeRange === 'custom' ? Math.ceil(((customEndDate as Date).getTime() - (customStartDate as Date).getTime()) / (1000 * 60 * 60 * 24)) + 1 :
                   7
  const startTime = timeRange === 'custom' ? (customStartDate as Date).getTime() : now.getTime() - (daysDiff * 24 * 60 * 60 * 1000)
  const endTime = timeRange === 'custom' ? (customEndDate as Date).getTime() : now.getTime()

  let seed = seed0
  const seededRandom = function(): number {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }
  const generateAreaData = function(baseValue: number, variance: number): [number, number][] {
    const points: [number, number][] = []
    for (let day = 0; day <= daysDiff; day++) {
      const timestamp = startTime + (day * 24 * 60 * 60 * 1000)
      if (timestamp > endTime) break
      const trend = Math.sin(day / daysDiff * Math.PI * 1.5) * variance * 0.4
      const noise = (seededRandom() - 0.5) * variance * 0.8
      const value = Math.round(Math.max(2, Math.min(98, baseValue + trend + noise)))
      points.push([timestamp, value])
    }
    return points
  }

  return {
    chart: {
      type: 'areaspline',
      height: 180,
      backgroundColor: 'transparent',
      spacingTop: 10,
      spacingBottom: 5,
      spacingRight: 10,
    },
    title: { text: null },
    credits: { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: timeRange === '7days' ? now.getTime() - 7 * 24 * 60 * 60 * 1000 :
           timeRange === '15days' ? now.getTime() - 15 * 24 * 60 * 60 * 1000 :
           timeRange === '4weeks' ? now.getTime() - 28 * 24 * 60 * 60 * 1000 :
           timeRange === 'custom' ? (customStartDate as Date).getTime() :
           now.getTime() - 7 * 24 * 60 * 60 * 1000,
      max: timeRange === 'custom' ? (customEndDate as Date).getTime() : now.getTime(),
      lineColor: 'rgba(0,0,0,0.09)',
      tickColor: 'rgba(0,0,0,0.09)',
      maxPadding: 0,
      labels: {
        style: { color: COLORS.textSecondary, fontSize: '12px' },
      },
    },
    yAxis: {
      title: { text: null },
      min: 0,
      max: 100,
      tickInterval: 25,
      maxPadding: 0,
      endOnTick: false,
      gridLineColor: COLORS.strokeSubtle,
      labels: {
        enabled: true,
        format: '{value}',
        style: { color: COLORS.textSecondary, fontSize: '12px' },
      },
    },
    tooltip: {
      useHTML: true,
      shared: true,
      backgroundColor: '#FFFFFF',
      borderColor: COLORS.strokeSubtle,
      borderRadius: '12px',
      padding: 12,
      shadow: CHART_DEFAULTS.tooltip.shadow,
      formatter: function(this: { x: number; points: Array<{ series: { color: string; name: string }; y: number }> }): string {
        const date = new Date(this.x)
        const formattedDate = format(date, 'MMM d, yyyy')
        let html = '<div style="font-size: 12px;">'
        html += '<div style="color: ' + COLORS.textSecondary + '; margin-bottom: 8px; font-weight: 600;">' + formattedDate + '</div>'
        this.points.forEach(function(point) {
          html += '<div style="margin-bottom: 3px;"><span style="color: ' + point.series.color + ';">●</span> <span style="color: ' + COLORS.fg2 + ';">' + point.series.name + ':</span> <b>' + point.y + '</b></div>'
        })
        html += '</div>'
        return html
      },
    },
    legend: { ...lineChartLegend, margin: 12 },
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
    series: [
      { name: 'Resolved', data: generateAreaData(78, 12), color: COLORS.chartBlue },
      { name: 'Escalated', data: generateAreaData(52, 14), color: COLORS.chartPink },
      { name: 'Abandoned', data: generateAreaData(35, 10), color: COLORS.chartPurple },
      { name: 'Unresolved', data: generateAreaData(18, 8), color: COLORS.fgSubtle },
    ],
  }
}

// ─── Answer Quality Bar Chart Builder ────────────────────────────────────────
export function buildAnswerQualityChartOptions({ handleEvaluationClick, questionsEvaluation }: BuildAnswerQualityChartParams): Record<string, unknown> {
  return {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: 180,
      marginRight: 60,
      marginTop: 20,
      marginBottom: 70,
    },
    title: { text: null },
    credits: { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      categories: ['Good', 'Poor'],
      labels: {
        style: { fontSize: '12px', fontWeight: '400', color: COLORS.fg2 },
      },
      gridLineWidth: 0,
      lineWidth: 0,
      tickWidth: 0,
    },
    yAxis: {
      min: 0,
      max: 100,
      gridLineWidth: 1,
      gridLineColor: COLORS.strokeLight,
      lineWidth: 0,
      tickWidth: 0,
      title: { text: null },
      labels: {
        format: '{value}%',
        style: { fontSize: '12px', fontWeight: '400', color: COLORS.textSecondary },
      },
    },
    legend: { ...lineChartLegend, margin: 16 },
    tooltip: {
      enabled: true,
      useHTML: true,
      backgroundColor: '#FFFFFF',
      borderColor: COLORS.strokeSubtle,
      borderWidth: 1,
      borderRadius: '6px',
      shadow: CHART_DEFAULTS.tooltip.shadow,
      style: { fontSize: '12px', color: COLORS.textPrimary },
      formatter: function(this: { point: { stackTotal?: number }; y: number; color: string; series: { name: string } }): string {
        const total = this.point.stackTotal || this.y;
        return '<div style="display:flex;flex-direction:column;gap:6px;padding:2px 0">'
          + '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap">'
          + '<span style="width:8px;height:8px;border-radius:50%;background:' + this.color + ';flex-shrink:0"></span>'
          + this.series.name + ' <b>' + this.y + '%</b> (of ' + total + '% sampled answers)'
          + '</div>'
          + '<div style="color:#0F6CBD;font-size:12px">\u2192 Click to see questions</div>'
          + '</div>';
      },
    },
    plotOptions: {
      bar: {
        stacking: 'normal',
        borderWidth: 0,
        cursor: 'pointer',
        point: {
          events: {
            click: function(this: { series: { name: string } }): void {
              const qualityFilter = this.series.name === 'Good' ? 'good' : 'poor';
              handleEvaluationClick({ ...questionsEvaluation, initialQualityFilter: qualityFilter });
            },
          },
        },
        dataLabels: {
          enabled: true,
          inside: true,
          align: 'left',
          formatter: function(this: { y: number }): string | null {
            if (this.y === 0) return null;
            return this.y + '%';
          },
          style: { fontSize: '12px', fontWeight: '600', color: COLORS.white, textOutline: 'none' },
          x: 5,
        },
        groupPadding: 0.15,
        pointPadding: 0.05,
      },
    },
    series: [
      { name: 'Good', data: [52, 0], color: COLORS.chartGreen, stack: 'quality' },
      { name: 'Incomplete', data: [0, 10], color: COLORS.chartPink, stack: 'quality' },
      { name: 'Irrelevant', data: [0, 18], color: COLORS.chartTeal, stack: 'quality' },
      { name: 'Incomplete Knowledge Use', data: [0, 20], color: COLORS.chartBlue, stack: 'quality' },
    ],
  }
}

// ─── Engagement Chart Builder ────────────────────────────────────────────────
export const ENGAGEMENT_SERIES: ChartSeriesData[] = [
  { name: 'Sessions', type: 'areaspline', color: COLORS.chartBlue, fillOpacity: 0.12, data: [[Date.UTC(2024,1,6),320],[Date.UTC(2024,1,7),345],[Date.UTC(2024,1,8),310],[Date.UTC(2024,1,9),358],[Date.UTC(2024,1,10),335],[Date.UTC(2024,1,11),362],[Date.UTC(2024,1,12),348]] },
  { name: 'DAU', type: 'areaspline', color: COLORS.chartGreen, fillOpacity: 0.12, data: [[Date.UTC(2024,1,6),185],[Date.UTC(2024,1,7),198],[Date.UTC(2024,1,8),172],[Date.UTC(2024,1,9),205],[Date.UTC(2024,1,10),192],[Date.UTC(2024,1,11),210],[Date.UTC(2024,1,12),195]] },
]

// ─── Mock Series Data ────────────────────────────────────────────────────────
export const TOOL_USE_SERIES: ChartSeriesData[] = [
  { name: 'Send email', color: COLORS.chartPink, data: [[Date.UTC(2024,1,6),105],[Date.UTC(2024,1,7),118],[Date.UTC(2024,1,8),98],[Date.UTC(2024,1,9),122],[Date.UTC(2024,1,10),108],[Date.UTC(2024,1,11),125],[Date.UTC(2024,1,12),115]] },
  { name: 'Update a row', color: COLORS.chartGreen, data: [[Date.UTC(2024,1,6),82],[Date.UTC(2024,1,7),95],[Date.UTC(2024,1,8),105],[Date.UTC(2024,1,9),92],[Date.UTC(2024,1,10),110],[Date.UTC(2024,1,11),98],[Date.UTC(2024,1,12),108]] },
  { name: 'Knowledge document creator', color: COLORS.chartOrange, data: [[Date.UTC(2024,1,6),88],[Date.UTC(2024,1,7),75],[Date.UTC(2024,1,8),82],[Date.UTC(2024,1,9),95],[Date.UTC(2024,1,10),72],[Date.UTC(2024,1,11),85],[Date.UTC(2024,1,12),78]] },
  { name: 'Knowledge document upload', color: COLORS.chartTeal, data: [[Date.UTC(2024,1,6),65],[Date.UTC(2024,1,7),72],[Date.UTC(2024,1,8),85],[Date.UTC(2024,1,9),68],[Date.UTC(2024,1,10),78],[Date.UTC(2024,1,11),70],[Date.UTC(2024,1,12),82]] },
  { name: 'Post to ServiceNow', color: COLORS.chartBlue, data: [[Date.UTC(2024,1,6),58],[Date.UTC(2024,1,7),52],[Date.UTC(2024,1,8),62],[Date.UTC(2024,1,9),68],[Date.UTC(2024,1,10),75],[Date.UTC(2024,1,11),65],[Date.UTC(2024,1,12),72]] },
]

export const TRIGGER_USE_SERIES: ChartSeriesData[] = [
  { name: 'Email received', color: COLORS.chartBlue, data: [[Date.UTC(2024,1,6),120],[Date.UTC(2024,1,7),135],[Date.UTC(2024,1,8),112],[Date.UTC(2024,1,9),128],[Date.UTC(2024,1,10),140],[Date.UTC(2024,1,11),132],[Date.UTC(2024,1,12),125]] },
  { name: 'Scheduled', color: COLORS.chartPink, data: [[Date.UTC(2024,1,6),95],[Date.UTC(2024,1,7),88],[Date.UTC(2024,1,8),102],[Date.UTC(2024,1,9),92],[Date.UTC(2024,1,10),98],[Date.UTC(2024,1,11),105],[Date.UTC(2024,1,12),96]] },
  { name: 'Dataverse row created', color: COLORS.chartGreen, data: [[Date.UTC(2024,1,6),72],[Date.UTC(2024,1,7),68],[Date.UTC(2024,1,8),75],[Date.UTC(2024,1,9),80],[Date.UTC(2024,1,10),70],[Date.UTC(2024,1,11),78],[Date.UTC(2024,1,12),74]] },
  { name: 'Teams message', color: COLORS.chartOrange, data: [[Date.UTC(2024,1,6),55],[Date.UTC(2024,1,7),62],[Date.UTC(2024,1,8),48],[Date.UTC(2024,1,9),58],[Date.UTC(2024,1,10),65],[Date.UTC(2024,1,11),52],[Date.UTC(2024,1,12),60]] },
  { name: 'HTTP webhook', color: COLORS.chartTeal, data: [[Date.UTC(2024,1,6),42],[Date.UTC(2024,1,7),38],[Date.UTC(2024,1,8),45],[Date.UTC(2024,1,9),40],[Date.UTC(2024,1,10),48],[Date.UTC(2024,1,11),44],[Date.UTC(2024,1,12),46]] },
]

// ─── Agent Click Evaluation Template ─────────────────────────────────────────
export const AGENT_CLICK_EVALUATION = {
  id: '1',
  evaluatedItem: { type: 'auto', name: 'Suggested theme', icon: '/Sparkle.svg' },
  dataType: 'Theme',
  categories: [] as string[],
  overallScore: 198,
  maxScore: 200,
  totalTestCases: 494,
  answeredQuestions: '56%',
  responseQuality: '34%',
  thumbsUp: 76,
  thumbsDown: 207,
  testMethods: 'General quality, Compare meaning',
  lastRunBy: { name: 'Daisy Phillips', avatar: '/Daisy Phillips.png', time: '5 minutes ago' },
  dataset: 'Home claims full set',
  hideOverview: true,
  lastUpdated: '5 minutes ago',
  name: '',
}
