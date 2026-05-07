import React, { useState, useMemo } from 'react'
import { Tooltip } from '@fluentui/react-components'
import { Dialog } from '../../../components/ui/Dialog'
import {
  Dismiss20Regular,
  Add16Regular,
  Info16Regular,
  Delete16Regular,
  ThumbLike20Regular,
  ThumbDislike20Regular,
} from '@fluentui/react-icons'
import { COLORS } from '../constants'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea'
import type { CustomMetric } from '../types'

// Chart colors for donut segments — each entry has the segment color + WCAG AA-compliant text color for chips
const CHART_COLOR_PAIRS = [
  { color: COLORS.chartBlue, text: '#2B4ACB' },       // #85A8F8 segment -> dark blue text
  { color: COLORS.chartPink, text: '#9E3C72' },       // #E8A0C8 segment -> dark pink text
  { color: COLORS.chartTeal, text: '#1B6F8A' },       // #7CC0E0 segment -> dark teal text
  { color: COLORS.chartPurple, text: '#5B3D8F' },     // #A890D0 segment -> dark purple text
  { color: COLORS.chartOrange, text: '#A85218' },     // #F4A470 segment -> dark orange text
  { color: COLORS.chartGreen, text: '#1D7A52' },      // #6DC4A0 segment -> dark green text
  { color: COLORS.chartLavender, text: '#3840A8' },   // #A8AEF8 segment -> dark lavender text
  { color: COLORS.chartRed, text: '#A82828' },         // #F09090 segment -> dark red text
]
const CHART_COLORS = CHART_COLOR_PAIRS.map(p => p.color)

// Sample questions for results tab
const SAMPLE_QUESTIONS = [
  'How do I reset my password?',
  'Can you check my order status?',
  'I need help with account access.',
  'Where can I update my billing info?',
  'Can you schedule a meeting for tomorrow?',
  'How do I report a bug?',
  'Which decisions do we need?',
  'Can you check my order status?',
  'Where can I update my billing info?',
  'Can you schedule a meeting for tomorrow?',
  'How do I report a bug?',
]

// Extract a concise but meaningful category name (1-2 words) from description
function getCategoryName(desc: string) {
  if (!desc || !desc.trim()) return 'Other'
  // Try to find a label before a colon (e.g., "Sale: ...")
  const colonMatch = desc.match(/^([^:]{2,30}):/)
  if (colonMatch) {
    const words = colonMatch[1].trim().split(/\s+/)
    return words.slice(0, 2).join(' ')
  }
  // Common adjective+noun patterns — keep as pair (e.g., "very friendly" -> "Very Friendly")
  const adjectives = ['very', 'not', 'highly', 'somewhat', 'slightly', 'extremely', 'moderately', 'partially', 'fully', 'mostly']
  const words = desc.trim().split(/\s+/).filter(w => w.length > 1)
  if (words.length >= 2 && adjectives.includes(words[0].toLowerCase())) {
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }
  // Take first two meaningful words (>2 chars)
  const meaningful = words.filter(w => w.length > 2)
  if (meaningful.length >= 2) {
    return meaningful.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }
  return meaningful[0] || words[0] || 'Other'
}

// Suggest a metric name based on the measure description
function suggestMetricName(desc: string) {
  if (!desc || !desc.trim()) return ''
  const lower = desc.toLowerCase()

  // Keyword-based suggestions
  const patterns = [
    { keywords: ['friendly', 'friendliness', 'warm', 'welcoming', 'approachab'], name: 'Friendliness grader' },
    { keywords: ['sale', 'sales', 'conversion', 'purchase', 'buy', 'checkout', 'payment', 'order'], name: 'Sales conversion tracker' },
    { keywords: ['sentiment', 'emotion', 'mood', 'feeling', 'tone'], name: 'Sentiment analyzer' },
    { keywords: ['resolution', 'resolved', 'solve', 'fix', 'issue'], name: 'Resolution tracker' },
    { keywords: ['satisfact', 'csat', 'happy', 'pleased', 'delight'], name: 'Satisfaction scorer' },
    { keywords: ['escalat', 'transfer', 'handoff', 'hand off', 'supervisor'], name: 'Escalation detector' },
    { keywords: ['compliance', 'policy', 'guideline', 'regulation', 'legal'], name: 'Compliance checker' },
    { keywords: ['quality', 'accurate', 'accuracy', 'correct', 'helpful'], name: 'Response quality grader' },
    { keywords: ['intent', 'goal', 'purpose', 'reason', 'want'], name: 'Intent classifier' },
    { keywords: ['churn', 'cancel', 'leave', 'unsubscribe', 'retention'], name: 'Churn risk detector' },
    { keywords: ['onboard', 'setup', 'getting started', 'first time', 'new user'], name: 'Onboarding evaluator' },
    { keywords: ['feedback', 'review', 'rating', 'opinion'], name: 'Feedback classifier' },
    { keywords: ['empathy', 'empathetic', 'understand', 'compassion'], name: 'Empathy scorer' },
    { keywords: ['response time', 'speed', 'latency', 'fast', 'slow', 'wait'], name: 'Response speed grader' },
    { keywords: ['knowledge', 'answer', 'inform', 'accurate'], name: 'Knowledge accuracy checker' },
    { keywords: ['upsell', 'cross-sell', 'recommend', 'suggest', 'upgrade'], name: 'Upsell opportunity tracker' },
  ]

  for (const p of patterns) {
    if (p.keywords.some(kw => lower.includes(kw))) {
      return p.name
    }
  }

  // Fallback: extract key noun phrases
  const words = desc.trim().split(/\s+/).slice(0, 4)
  return words.join(' ') + ' metric'
}

interface DonutChartProps {
  segments: Array<{ value: number; color: string; label?: string }>
  size?: number
  thickness?: number
}

// SVG donut chart component with gaps between segments
function DonutChart({ segments, size = 160, thickness = 28 }: DonutChartProps) {
  const radius = (size - thickness) / 2
  const center = size / 2
  const gapDeg = 3 // gap in degrees between segments
  const totalGap = gapDeg * segments.length
  const usableDeg = 360 - totalGap
  let currentAngle = -90

  // Convert polar to cartesian
  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)]
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const sweepDeg = (seg.value / 100) * usableDeg
        const startAngle = currentAngle
        const endAngle = startAngle + sweepDeg
        currentAngle = endAngle + gapDeg

        const [x1, y1] = toXY(startAngle, radius)
        const [x2, y2] = toXY(endAngle, radius)
        const largeArc = sweepDeg > 180 ? 1 : 0

        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            style={{ transition: 'all 300ms ease' }}
          />
        )
      })}
    </svg>
  )
}

// AI disclaimer footer
function AIDisclaimer() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: '12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 0',
      }}>
        <span style={{ fontSize: '12px', color: 'hsl(var(--text-disabled))' }}>
          AI-generated content may be incorrect.
        </span>
        <span style={{ fontSize: '12px', color: '#0F6CBD', cursor: 'pointer' }}>
          Learn more
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <CopilotButton variant="icon-subtle" size="xs" aria-label="Thumbs up" style={{ color: 'hsl(var(--text-disabled))' }}>
          <ThumbLike20Regular />
        </CopilotButton>
        <CopilotButton variant="icon-subtle" size="xs" aria-label="Thumbs down" style={{ color: 'hsl(var(--text-disabled))' }}>
          <ThumbDislike20Regular />
        </CopilotButton>
      </div>
    </div>
  )
}

interface CustomMetricDialogProps {
  open: boolean
  onClose: () => void
  onSave: (metric: CustomMetric) => void
  initialData?: CustomMetric
}

export default function CustomMetricDialog({ open, onClose, onSave, initialData }: CustomMetricDialogProps) {
  const [step, setStep] = useState(1)
  const [metricName, setMetricName] = useState('')
  const [measureDescription, setMeasureDescription] = useState('')
  const [categories, setCategories] = useState([{ id: 1, description: '' }])
  const [nextCategoryId, setNextCategoryId] = useState(2)
  const [step2Tab, setStep2Tab] = useState('preview')

  // Pre-fill when initialData changes (edit mode)
  React.useEffect(() => {
    if (open && initialData) {
      setMetricName(initialData.metricName || '')
      setMeasureDescription(initialData.measureDescription || '')
      const cats = (initialData.categories || []).length > 0
        ? (initialData.categories || []).map((c, i) => ({ id: i + 1, description: c.description || '' }))
        : [{ id: 1, description: '' }]
      setCategories(cats)
      setNextCategoryId(cats.length + 1)
      setStep(1)
      setStep2Tab('preview')
    } else if (open && !initialData) {
      setMetricName('')
      setMeasureDescription('')
      setCategories([{ id: 1, description: '' }])
      setNextCategoryId(2)
      setStep(1)
      setStep2Tab('preview')
    }
  }, [open, initialData])

  const handleClose = () => {
    setStep(1)
    setMetricName('')
    setMeasureDescription('')
    setCategories([{ id: 1, description: '' }])
    setNextCategoryId(2)
    setStep2Tab('preview')
    onClose()
  }

  const handleAddCategory = () => {
    setCategories([...categories, { id: nextCategoryId, description: '' }])
    setNextCategoryId(nextCategoryId + 1)
  }

  const handleRemoveCategory = (id: number) => {
    if (categories.length > 1) {
      setCategories(categories.filter(c => c.id !== id))
    }
  }

  const handleCategoryChange = (id: number, value: string) => {
    setCategories(categories.map(c => c.id === id ? { ...c, description: value } : c))
  }

  const handleNext = () => {
    if (step === 1) setStep(2)
  }

  const handleBack = () => {
    if (step === 2) setStep(1)
  }

  const handleSave = () => {
    onSave({
      metricName: metricName.trim() || suggestedName || 'Custom metric',
      measureDescription,
      categories: categories.filter(c => c.description.trim()),
    })
    handleClose()
  }

  const hasFilledCategory = categories.some(c => c.description.trim().length > 0)
  const isStep1Valid = measureDescription.trim().length > 0 && hasFilledCategory

  // Suggest metric name based on description
  const suggestedName = useMemo(() => suggestMetricName(measureDescription), [measureDescription])
  const effectiveMetricName = metricName.trim() || suggestedName || 'Custom metric'

  // Derive category names and mock data for step 2
  const filledCategories = useMemo(() => {
    const filled = categories
      .filter(c => c.description.trim())
      .map((c, i) => ({
        ...c,
        name: getCategoryName(c.description),
        color: CHART_COLOR_PAIRS[i % CHART_COLOR_PAIRS.length].color,
        textColor: CHART_COLOR_PAIRS[i % CHART_COLOR_PAIRS.length].text,
      }))
    return filled
  }, [categories])

  // Generate mock donut percentages — hide "Other" if 0%
  const donutSegments = useMemo(() => {
    if (filledCategories.length === 0) return [{ label: 'Other', value: 100, color: COLORS.chartGrey as string }]
    const mockPcts = [45, 25, 15, 10, 8, 5]
    const otherPct = filledCategories.length >= 6 ? 0 : 10
    const catPcts = mockPcts.slice(0, filledCategories.length)
    const total = catPcts.reduce((a, b) => a + b, 0) + otherPct
    const segments: { label: string; value: number; color: string }[] = filledCategories.map((c, i) => ({
      label: c.name,
      value: Math.round((catPcts[i] / total) * 100),
      color: c.color as string,
    }))
    const otherRounded = Math.round((otherPct / total) * 100)
    if (otherRounded > 0) {
      segments.push({ label: 'Other', value: otherRounded, color: COLORS.chartGrey })
    }
    return segments
  }, [filledCategories])

  // Generate mock results rows
  const resultsRows = useMemo(() => {
    const hasOther = donutSegments.some(s => s.label === 'Other')
    const allNames = [...filledCategories.map(c => c.name), ...(hasOther ? ['Other'] : [])]
    return SAMPLE_QUESTIONS.map((q, i) => ({
      question: q,
      result: allNames[i % allNames.length],
      categoryIndex: i % allNames.length,
    }))
  }, [filledCategories, donutSegments])

  // Generate prompt text matching the reference format
  const promptText = useMemo(() => {
    const catNames = filledCategories.map(c => c.name)
    const metricLabel = metricName.trim() || suggestedName || 'Custom Metric'

    let text = `You are a specialist with expertise in evaluating conversations. Your task is to determine if the provided response meets the criteria for our '${metricLabel}' metric.\n\n`
    text += `Base your decision exclusively on the content of the provided response. Do not assume any unstated actions or resolutions.\n\n`
    text += `Classification Rubric & Indicators\n\n`

    filledCategories.forEach((cat, i) => {
      const name = catNames[i]
      const desc = cat.description.trim()
      text += `Category: ${name}\n`
      text += `  * Indicator ${i + 1}.1: ${desc}\n`
      text += `  * Indicator ${i + 1}.2: Additional criteria derived from the category description.\n\n`
    })

    return text
  }, [filledCategories, metricName, suggestedName])

  const step2Tabs = ['Preview', 'Results', 'Prompt']

  return (
    <Dialog isOpen={open} onClose={handleClose} maxWidth="5xl" height="800px" containerStyle={{ maxWidth: '960px', width: '960px' }}>
          {/* Close button */}
          <CopilotButton
            variant="icon-subtle"
            size="xs"
            aria-label="Close"
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 1,
            }}
          >
            <Dismiss20Regular />
          </CopilotButton>

          {/* Content area */}
          <div style={{
            flex: 1,
            padding: '24px 24px 0 24px',
            overflowY: 'auto',
          }}>
            {step === 1 ? (
              /* ---- Step 1: Define Metric ---- */
              <>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: COLORS.textPrimary,
                    display: 'block',
                    marginBottom: '4px',
                    textAlign: 'center',
                    width: '100%',
                  }}>
                    Create a custom metric
                  </h2>
                  <span style={{
                    fontSize: '14px',
                    color: 'hsl(var(--text-disabled))',
                    lineHeight: '20px',
                    textAlign: 'center',
                    maxWidth: '460px',
                  }}>
                    Define what you want to measure, and we'll automatically analyze your conversations to generate a visual breakdown of the results.
                  </span>
                </div>

                {/* Metric name input */}
                <div style={{ marginBottom: '16px' }}>
                  <CopilotTextarea
                    value={metricName}
                    onChange={(e) => setMetricName(e.target.value)}
                    placeholder={suggestedName || "Metric name"}
                    rows={1}
                    size="sm"
                  />
                </div>

                {/* What do you want to measure? */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: COLORS.textPrimary,
                    }}>
                      What do you want to measure?
                    </span>
                    <Tooltip content="Describe the outcome you want to track. Be specific about what constitutes each result category." relationship="label">
                      <Info16Regular style={{ color: 'hsl(var(--text-disabled))', cursor: 'help' }} />
                    </Tooltip>
                  </div>
                  <CopilotTextarea
                    value={measureDescription}
                    onChange={(e) => setMeasureDescription(e.target.value)}
                    placeholder={`Describe the outcome you want to track across all conversations.\nExample: Sales Conversion Outcome evaluates whether a conversation results in an explicit sale. Use the full session. If both sale and non-sale signals appear, the customer's latest explicit decision determines the classification.\nIn scope: Conversations with sale-related discussion (e.g. pricing, offers, checkout/payment, ordering, subscription start, renewal, trial-to-paid etc).`}
                    rows={5}
                    size="sm"
                  />
                </div>

                {/* Result categories */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <span style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: COLORS.textPrimary,
                      }}>
                        Result categories
                      </span>
                      <Tooltip content="Define the possible outcomes for classifying conversations. Unmatched results will be labeled as 'Other'." relationship="label">
                        <Info16Regular style={{ color: 'hsl(var(--text-disabled))', cursor: 'help' }} />
                      </Tooltip>
                    </div>
                    <CopilotButton variant="secondary" size="sm" onClick={handleAddCategory}>
                      <Add16Regular />
                      Add category
                    </CopilotButton>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: 'hsl(var(--text-disabled))',
                      lineHeight: '20px',
                      display: 'block',
                    }}>
                      Define the possible outcomes. Each conversation will be automatically classified into one of these categories.
                    </span>
                    <span style={{
                      fontSize: '14px',
                      color: 'hsl(var(--text-disabled))',
                      lineHeight: '20px',
                      display: 'block',
                    }}>
                      Unmatched results will be labeled as 'Other'.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categories.map((cat, idx) => (
                      <div key={cat.id} style={{ position: 'relative' }}>
                        <CopilotTextarea
                          value={cat.description}
                          onChange={(e) => handleCategoryChange(cat.id, e.target.value)}
                          placeholder={idx === 0 ? "For example: Sale result when the customer explicitly affirms the decision to purchase in the conversation and the agent confirms order creation or payment." : "Add category."}
                          style={{
                            ...(idx > 0 && { paddingRight: '32px' }),
                          }}
                          rows={idx === 0 ? 2 : 1}
                          size="sm"
                        />
                        {idx > 0 && (
                          <CopilotButton
                            variant="icon-subtle"
                            size="xs"
                            onClick={() => handleRemoveCategory(cat.id)}
                            aria-label="Remove category"
                            style={{
                              position: 'absolute',
                              top: '50%',
                              right: '12px',
                              transform: 'translateY(-50%)',
                              color: 'hsl(var(--text-disabled))',
                            }}
                          >
                            <Delete16Regular />
                          </CopilotButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* ---- Step 2: Preview / Results / Prompt ---- */
              <>
                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: COLORS.textPrimary,
                    display: 'block',
                    textAlign: 'center',
                  }}>
                    Create a custom metric
                  </h2>
                </div>

                {/* Tab switcher */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'inline-flex',
                    backgroundColor: 'hsl(var(--surface-quaternary))',
                    borderRadius: '12px',
                    padding: '2px',
                  }}>
                    {step2Tabs.map((tab) => {
                      const tabKey = tab.toLowerCase()
                      const isActive = step2Tab === tabKey
                      return (
                        <CopilotButton
                          key={tab}
                          variant="ghost"
                          size="xs"
                          onClick={() => setStep2Tab(tabKey)}
                          style={{
                            padding: '4px 16px',
                            fontSize: '14px',
                            fontWeight: isActive ? '600' : '400',
                            color: isActive ? COLORS.textPrimary : '#8A8886',
                            backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                            borderRadius: '8px',
                            transition: 'all 150ms ease',
                          }}
                        >
                          {tab}
                        </CopilotButton>
                      )
                    })}
                  </div>
                </div>

                {/* Tab content */}
                {step2Tab === 'preview' && (
                  <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                    {/* Donut card */}
                    <div style={{
                      border: `1px solid ${COLORS.strokeLight}`,
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}>
                      {/* Metric name */}
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: COLORS.textPrimary,
                        alignSelf: 'flex-start',
                        marginBottom: '16px',
                      }}>
                        {effectiveMetricName}
                      </span>

                      {/* Chart + Legend */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                        justifyContent: 'center',
                        width: '100%',
                      }}>
                        <DonutChart segments={donutSegments} size={160} thickness={28} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {donutSegments.map((seg, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: seg.color,
                                flexShrink: 0,
                              }} />
                              <span style={{ fontSize: '14px', color: COLORS.textPrimary }}>
                                {seg.label}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textPrimary }}>
                                {seg.value}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Sample data info */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '12px',
                    }}>
                      <Info16Regular style={{ color: 'hsl(var(--text-disabled))' }} />
                      <span style={{ fontSize: '12px', color: 'hsl(var(--text-disabled))' }}>
                        This calculation is based on sample data on 100 sessions
                      </span>
                    </div>

                    <AIDisclaimer />
                  </div>
                )}

                {step2Tab === 'results' && (
                  <>
                    {/* Results table — full width */}
                    <div style={{
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}>
                      {/* Header row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 16px',
                        backgroundColor: 'hsl(var(--surface-tertiary))',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                      }}>
                        <span style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: COLORS.textSecondary }}>
                          Reasoning
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: COLORS.textSecondary, width: '120px', textAlign: 'center' }}>
                          Result
                        </span>
                      </div>

                      {/* Data rows */}
                      <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                        {resultsRows.map((row, i) => {
                          const isOther = row.result === 'Other'
                          const cat = filledCategories.find(c => c.name === row.result)
                          const chipBg = isOther
                            ? 'hsl(var(--stroke-default))'
                            : cat ? `${cat.color}1A` : `${CHART_COLOR_PAIRS[0].color}1A`
                          const chipColor = isOther
                            ? 'hsl(var(--text-disabled))'
                            : cat ? cat.textColor : CHART_COLOR_PAIRS[0].text
                          return (
                            <div key={i} style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 16px',
                              borderBottom: i < resultsRows.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            }}>
                              <span style={{ flex: 1, fontSize: '14px', color: COLORS.textPrimary }}>
                                {row.question}
                              </span>
                              <div style={{ width: '120px', display: 'flex', justifyContent: 'center' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: chipBg,
                                  color: chipColor,
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  lineHeight: '1.33',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  width: '120px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {row.result}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <AIDisclaimer />
                  </>
                )}

                {step2Tab === 'prompt' && (
                  <>
                    {/* Prompt text card — full width */}
                    <div style={{
                      border: '1px solid rgba(0,0,0,0.09)',
                      borderRadius: '12px',
                      padding: '20px',
                      maxHeight: '480px',
                      overflowY: 'auto',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        color: COLORS.textPrimary,
                        lineHeight: '22px',
                        whiteSpace: 'pre-wrap',
                        display: 'block',
                      }}>
                        {promptText}
                      </span>
                    </div>

                    <AIDisclaimer />
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px 24px 24px',
          }}>
            {/* Back button */}
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={handleBack}
              disabled={step === 1}
              style={{ minWidth: '72px' }}
            >
              Back
            </CopilotButton>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <div style={{
                width: step === 1 ? '16px' : '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: step === 1 ? COLORS.textPrimary : 'rgba(0,0,0,0.09)',
                transition: 'all 200ms ease',
              }} />
              <div style={{
                width: step === 2 ? '16px' : '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: step === 2 ? COLORS.textPrimary : 'rgba(0,0,0,0.09)',
                transition: 'all 200ms ease',
              }} />
            </div>

            {/* Next / Save metric button */}
            {step === 1 ? (
              <CopilotButton
                variant="primary"
                size="sm"
                onClick={handleNext}
                disabled={!isStep1Valid}
                style={{ minWidth: '72px' }}
              >
                Next
              </CopilotButton>
            ) : (
              <CopilotButton
                variant="primary"
                size="sm"
                onClick={handleSave}
                style={{ minWidth: '100px' }}
              >
                Save metric
              </CopilotButton>
            )}
          </div>
    </Dialog>
  )
}
