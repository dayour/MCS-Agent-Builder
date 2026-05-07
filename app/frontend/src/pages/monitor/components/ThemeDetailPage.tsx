import React, { useState } from 'react'
import {
  Avatar,
  Tooltip,
} from '@fluentui/react-components'
import {
  Search20Regular,
  Dismiss12Regular,
  ArrowDownload20Regular,
  BeakerSettings20Regular,
  Sparkle20Regular,
} from '@fluentui/react-icons'
import { COLORS, CLS } from '../constants'
import { updatedMockEvaluationRuns, getRunResults } from '../data/mockData'
import { DetailPageHeader, KPIItem, StatusBadge, QualityBadge, FilterMenu, Pagination } from './SharedComponents'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import type { Evaluation, EvaluationRun, Question } from '../types'

interface QuestionItem {
  question: string
  answered: boolean
  testScores: Record<string, string>
  reaction: string | null
  comment: string | null
  date: string
  knowledgeSources?: string[]
  agentResponse?: string
  userQuery?: string
  responseQuality?: number
}

interface ThemeDetailPageProps {
  evaluation: Evaluation
  onBack: () => void
  onRunClick?: (run: EvaluationRun) => void
  mode?: string
  onQuestionSelect?: (question: QuestionItem) => void
}

function ThemeDetailPage({ evaluation, onBack, onRunClick, mode = 'questions', onQuestionSelect }: ThemeDetailPageProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState(evaluation?.initialQualityFilter || 'all')
  const [reactionFilter, setReactionFilter] = useState(evaluation?.initialReactionFilter || 'all')
  const [commentFilter, setCommentFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const itemsPerPage = 10

  if (!evaluation) {
    return null
  }

  // Mock comments data for comments mode
  const mockComments = [
    { question: 'The bot kept repeating the same response even after I clarified my question.', reaction: 'down', comment: 'Repetitive loop issue', date: '02/20/26', answered: true, knowledgeSources: ['FAQ Database'], testScores: {}, userQuery: 'How do I change my subscription plan?', agentResponse: 'To change your subscription plan, go to Settings > Subscription. To change your subscription plan, go to Settings > Subscription. To change your subscription plan, go to Settings > Subscription.' },
    { question: 'Really helpful — got my refund processed in under 2 minutes!', reaction: 'up', comment: 'Fast resolution', date: '02/19/26', answered: true, knowledgeSources: ['Refund Policy.pdf', 'Order Database'], testScores: {}, userQuery: 'I need a refund for order #45821', agentResponse: 'I\'ve processed your refund for order #45821. The amount of $34.99 will be returned to your original payment method within 3-5 business days.' },
    { question: 'I asked for store hours and it gave me the return policy instead.', reaction: 'down', comment: 'Wrong intent detected', date: '02/18/26', answered: true, knowledgeSources: ['Return Policy.docx'], testScores: {}, userQuery: 'What are the store hours for the downtown location?', agentResponse: 'Our return policy allows returns within 30 days of purchase with a valid receipt. Items must be in their original packaging.' },
    { question: 'Smooth experience, answered all my shipping questions accurately.', reaction: 'up', comment: 'Great accuracy', date: '02/18/26', answered: true, knowledgeSources: ['Shipping FAQ', 'Carrier Database'], testScores: {}, userQuery: 'How long does express shipping take to California?', agentResponse: 'Express shipping to California typically takes 2-3 business days. You can track your package using the tracking number provided in your confirmation email.' },
    { question: 'The bot didn\'t understand my question about billing at all.', reaction: 'down', comment: 'Failed to parse billing query', date: '02/17/26', answered: true, knowledgeSources: [], testScores: {}, userQuery: 'Why was I charged twice this month?', agentResponse: 'I can help you with billing questions. Please provide your account number to get started.' },
    { question: 'Loved the quick suggestions — made it easy to find what I needed.', reaction: 'up', comment: 'Good suggestion cards', date: '02/16/26', answered: true, knowledgeSources: ['Product Catalog', 'www.store.com'], testScores: {}, userQuery: 'I\'m looking for wireless headphones under $100', agentResponse: 'Here are our top wireless headphones under $100: 1) SoundPro X2 ($79.99) - 30hr battery, 2) AudioMax Lite ($64.99) - noise cancelling, 3) BassBoost Mini ($49.99) - water resistant.' },
    { question: 'Agent transferred me to a human seamlessly when it couldn\'t help.', reaction: 'up', comment: 'Smooth escalation', date: '02/15/26', answered: true, knowledgeSources: ['Escalation Protocol'], testScores: {}, userQuery: 'I need to dispute a charge on my corporate account', agentResponse: 'I understand you need to dispute a charge on your corporate account. This requires a specialist. Let me transfer you to our corporate billing team — they\'ll have full access to your account details.' },
    { question: 'It asked me for my order number three times in a row.', reaction: 'down', comment: 'Context not retained', date: '02/14/26', answered: true, knowledgeSources: ['Order Database'], testScores: {}, userQuery: 'Where is my order #78234?', agentResponse: 'Could you please provide your order number so I can look that up for you?' },
    { question: 'Very polite and professional tone throughout the conversation.', reaction: 'up', comment: 'Great tone', date: '02/13/26', answered: true, knowledgeSources: ['Account Portal', 'FAQ Database'], testScores: {}, userQuery: 'How do I reset my password?', agentResponse: 'I\'d be happy to help you reset your password! Please visit your Account Settings page and click "Reset Password." You\'ll receive an email with a secure link to create a new password. Is there anything else I can assist you with?' },
    { question: 'The bot went completely off-topic when I asked about warranties.', reaction: 'down', comment: 'Off-topic response', date: '02/12/26', answered: true, knowledgeSources: ['Product Catalog'], testScores: {}, userQuery: 'What\'s the warranty on the SoundPro X2 headphones?', agentResponse: 'The SoundPro X2 headphones come in black, white, and navy blue. They feature 30-hour battery life and Bluetooth 5.3 connectivity.' },
    { question: 'Helped me track my package instantly, very convenient.', reaction: 'up', comment: 'Quick tracking lookup', date: '02/11/26', answered: true, knowledgeSources: ['Carrier Database', 'Order Database'], testScores: {}, userQuery: 'Can you track my recent order?', agentResponse: 'Your order #92847 shipped via FedEx on Feb 9. Tracking number: FX789456123. Current status: In transit — estimated delivery Feb 12. Would you like me to set up delivery notifications?' },
    { question: 'No issues at all — resolved my account lock in seconds.', reaction: 'up', comment: null, date: '02/10/26', answered: true, knowledgeSources: ['Account Portal'], testScores: {}, userQuery: 'My account is locked and I can\'t log in', agentResponse: 'I\'ve unlocked your account. You can now log in with your existing credentials. For security, I recommend changing your password after logging in.' },
  ]

  // Get questions from the latest run
  const runs = updatedMockEvaluationRuns[evaluation.id] || []
  const latestRun = runs[0]
  const allQuestions: QuestionItem[] = (mode === 'comments' || mode === 'responses') ? mockComments : (latestRun ? getRunResults(evaluation.id, latestRun.id) : []).slice(0, 50)

  // Helper to compute quality pct for a result
  const getQualityPct = (result: { testScores?: Record<string, string> }) => {
    const scores: string[] = Object.values(result.testScores || {})
    if (scores.length === 0) return 50
    return Math.round((scores.filter((s: string) => s === 'Pass').length / scores.length) * 100)
  }

  // Collect unique knowledge sources for filter
  const allSources = Array.from(new Set(allQuestions.flatMap((q: QuestionItem) => q.knowledgeSources || []))).sort()

  // Apply filters
  const questions = allQuestions.filter((q: QuestionItem) => {
    if (searchQuery) {
      const searchField = mode === 'responses' ? (q.agentResponse || q.question) : q.question
      if (!searchField.toLowerCase().includes(searchQuery.toLowerCase())) return false
    }
    if (statusFilter !== 'all') {
      const isAnswered = q.answered !== false
      if (statusFilter === 'answered' && !isAnswered) return false
      if (statusFilter === 'unanswered' && isAnswered) return false
    }
    if (qualityFilter !== 'all') {
      const isAnswered = q.answered !== false
      if (!isAnswered) return false
      const pct = getQualityPct(q)
      if (qualityFilter === 'good' && pct < 70) return false
      if (qualityFilter === 'poor' && pct >= 50) return false
    }
    if (reactionFilter !== 'all') {
      if (reactionFilter === 'up' && q.reaction !== 'up') return false
      if (reactionFilter === 'down' && q.reaction !== 'down') return false
    }
    if (commentFilter !== 'all') {
      if (commentFilter === 'with' && !q.comment) return false
      if (commentFilter === 'without' && q.comment) return false
    }
    if (sourceFilter !== 'all') {
      if (!(q.knowledgeSources || []).includes(sourceFilter)) return false
    }
    if (dateFilter !== 'all') {
      if (!q.date) return false
      const today = new Date(2026, 1, 23)
      const parts = q.date.split('/')
      const qDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
      const diffDays = Math.floor((today.getTime() - qDate.getTime()) / (1000 * 60 * 60 * 24))
      if (dateFilter === '7days' && diffDays > 7) return false
      if (dateFilter === '14days' && diffDays > 14) return false
      if (dateFilter === '30days' && diffDays > 30) return false
    }
    return true
  })

  const hasActiveFilters = statusFilter !== 'all' || qualityFilter !== 'all' || reactionFilter !== 'all' || commentFilter !== 'all' || sourceFilter !== 'all' || dateFilter !== 'all' || searchQuery !== ''

  // Pagination
  const totalPages = Math.ceil(questions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentQuestions = questions.slice(startIndex, endIndex)

  // KPI calculations
  const totalQuestions = evaluation.totalTestCases || questions.length
  const answeredPct = parseInt(evaluation.answeredQuestions || '0') || 0
  const answeredCount = Math.round((answeredPct / 100) * totalQuestions)
  const unansweredCount = totalQuestions - answeredCount

  // Thumbs up/down SVG icons (line style, matching grid outside)
  const ThumbUpIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.052 2.29418C10.3913 1.31688 11.6841 0.866611 12.4829 1.70374C12.6455 1.87416 12.8081 2.05832 12.9176 2.22254C13.2379 2.70305 13.3725 3.33584 13.4218 3.9522C13.4721 4.58034 13.438 5.25446 13.3738 5.86473C13.3093 6.47735 13.2129 7.03948 13.1328 7.44766C13.1294 7.46535 13.1259 7.48277 13.1225 7.49989H14.006C15.8777 7.49989 17.2924 9.19503 16.9576 11.0365L16.2737 14.7983C15.8017 17.3942 13.2078 19.0289 10.6622 18.3347L5.06251 16.8075C4.14894 16.5583 3.45455 15.8144 3.26885 14.8859L2.91581 13.1207C2.63809 11.7321 3.69991 10.5623 4.82905 10.116C5.15163 9.9885 5.44337 9.82668 5.66974 9.62586C7.37583 8.11234 7.99442 6.90276 9.05406 4.77684C9.4084 4.06594 9.77205 3.10043 10.052 2.29418ZM12.0165 7.87851L12.0169 7.87696L12.0187 7.86962L12.0262 7.83852C12.0328 7.81068 12.0426 7.76892 12.0549 7.71482C12.0793 7.60658 12.1135 7.44919 12.1515 7.25525C12.2277 6.86655 12.3188 6.33493 12.3793 5.76005C12.4401 5.18282 12.4685 4.57569 12.425 4.03195C12.3806 3.47644 12.2652 3.04673 12.0855 2.77724C12.0264 2.68859 11.9138 2.55593 11.7594 2.3941C11.5605 2.18565 11.1314 2.23417 10.9967 2.62217C10.7141 3.43598 10.3334 4.45183 9.94904 5.22294C8.88216 7.36338 8.19326 8.72396 6.33336 10.3739C5.99304 10.6758 5.58878 10.891 5.19665 11.046C4.31631 11.394 3.75035 12.1944 3.89639 12.9246L4.24943 14.6898C4.36085 15.2469 4.77748 15.6932 5.32562 15.8427L10.9254 17.3699C12.9052 17.9099 14.9227 16.6384 15.2898 14.6194L15.9738 10.8577C16.197 9.62998 15.2538 8.49989 14.006 8.49989H12.5015C12.3476 8.49989 12.2022 8.42895 12.1074 8.3076C12.0127 8.18627 11.9792 8.02785 12.0165 7.87851C12.0165 7.87847 12.0165 7.87855 12.0165 7.87851Z" fill="currentColor"/>
    </svg>
  )
  const ThumbDownIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.052 17.7057C10.3913 18.683 11.6841 19.1333 12.4829 18.2962C12.6455 18.1257 12.8081 17.9416 12.9176 17.7774C13.2379 17.2968 13.3725 16.6641 13.4218 16.0477C13.4721 15.4195 13.438 14.7454 13.3738 14.1352C13.3093 13.5225 13.2129 12.9604 13.1328 12.5522C13.1294 12.5345 13.1259 12.5171 13.1225 12.5H14.006C15.8777 12.5 17.2924 10.8049 16.9576 8.96334L16.2737 5.20164C15.8017 2.60569 13.2078 0.970952 10.6622 1.66519L5.06251 3.19239C4.14894 3.44154 3.45455 4.18547 3.26885 5.11401L2.91581 6.87918C2.63809 8.2678 3.69991 9.43756 4.82905 9.88388C5.15163 10.0114 5.44337 10.1732 5.66974 10.374C7.37583 11.8875 7.99442 13.0971 9.05406 15.2231C9.4084 15.9339 9.77205 16.8995 10.052 17.7057ZM12.0165 12.1214L12.0169 12.1229L12.0187 12.1303L12.0262 12.1614C12.0328 12.1892 12.0426 12.231 12.0549 12.2851C12.0793 12.3933 12.1135 12.5507 12.1515 12.7446C12.2277 13.1333 12.3188 13.665 12.3793 14.2398C12.4401 14.8171 12.4685 15.4242 12.425 15.9679C12.3806 16.5235 12.2652 16.9532 12.0855 17.2227C12.0264 17.3113 11.9138 17.444 11.7594 17.6058C11.5605 17.8142 11.1314 17.7657 10.9967 17.3777C10.7141 16.5639 10.3334 15.5481 9.94904 14.777C8.88216 12.6365 8.19326 11.2759 6.33336 9.62597C5.99304 9.32406 5.58878 9.1089 5.19665 8.9539C4.31631 8.60592 3.75035 7.80549 3.89639 7.0753L4.24943 5.31013C4.36085 4.753 4.77748 4.30665 5.32562 4.15715L10.9254 2.62995C12.9052 2.08999 14.9227 3.36145 15.2898 5.38053L15.9738 9.14223C16.197 10.3699 15.2538 11.5 14.006 11.5H12.5015C12.3476 11.5 12.2022 11.5709 12.1074 11.6923C12.0127 11.8136 11.9792 11.972 12.0165 12.1214C12.0165 12.1214 12.0165 12.1213 12.0165 12.1214Z" fill="currentColor"/>
    </svg>
  )
  const CommentIcon = () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2C14.4183 2 18 5.07068 18 8.86364C18 12.6566 14.4183 15.7273 10 15.7273C9.43595 15.7273 8.88636 15.6771 8.35674 15.5814L5.55726 17.8418C5.19213 18.1367 4.66532 17.8739 4.66532 17.4052V14.2041C3.02949 12.9316 2 11.0155 2 8.86364C2 5.07068 5.58172 2 10 2ZM10 3C6.13401 3 3 5.62264 3 8.86364C3 10.7345 3.96835 12.3855 5.48424 13.4505L5.66532 13.5709V16.3024L7.87915 14.5167L8.14256 14.5918C8.73498 14.7609 9.35838 14.8542 10 14.8542C13.866 14.8542 17 12.2316 17 8.86364C17 5.62264 13.866 3 10 3Z" fill="currentColor"/>
    </svg>
  )

  return (
    <div className={CLS.pageRoot}>
      <div className={`${CLS.pageInner} pt-2.5`}>
       <div className="max-w-full mx-auto">
        {/* Header */}
        <DetailPageHeader title={evaluation.name} onBack={onBack}>
          <div className="flex items-center gap-1">
            <CopilotButton variant="ghost" size="xs"><ArrowDownload20Regular /> Download</CopilotButton>
            <CopilotButton variant="ghost" size="xs"><BeakerSettings20Regular /> Evaluate</CopilotButton>
          </div>
        </DetailPageHeader>
        <div className="mb-2.5" style={{ marginTop: '-4px' }}>

          {/* Tags Row - hidden in comments/responses mode */}
          {mode !== 'comments' && mode !== 'responses' && (
          <div className="flex items-center gap-2 mt-2">
            {/* Auto/Tracked badge */}
            <div className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md border border-[rgba(0,0,0,0.06)] bg-white">
              <span className="w-4 h-4">
                {evaluation.evaluatedItem.type === 'tracked' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" />
                  </svg>
                ) : (
                  <Sparkle20Regular style={{ width: '14px', height: '14px' }} />
                )}
              </span>
              <span className="text-xs text-gray-600">
                {evaluation.evaluatedItem.type === 'tracked' ? 'Tracked' : 'Suggested'}
              </span>
            </div>

            {/* Category badges */}
            {evaluation.categories?.map((cat, idx) => (
              <span
                key={idx}
                className="inline-flex items-center h-5 px-2 rounded-md border border-[rgba(0,0,0,0.09)] text-[11px] text-gray-500"
                style={{ borderColor: COLORS.strokeSubtle }}
              >
                {cat}
              </span>
            ))}

            {/* Last tracked */}
            {evaluation.lastUpdated && (
              <span className="text-[11px] text-gray-500" style={{ color: COLORS.textTertiary }}>
                Last tracked: {evaluation.lastUpdated}
              </span>
            )}
          </div>
          )}

          {/* Description */}
          {evaluation.description && (
            <span className="text-xs text-gray-500" style={{ color: COLORS.textSecondary, marginTop: '8px', display: 'block' }}>
              {evaluation.description}
            </span>
          )}
        </div>

        {/* KPI Overview - hidden when hideOverview flag is set */}
        {(mode === 'comments' || mode === 'responses') ? (
        <div className={CLS.cardCompact} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KPIItem
              value={allQuestions.length.toLocaleString()}
              label={mode === 'responses' ? 'Total responses' : 'Total comments'}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbUpIcon size={20} /></span>
                  <span className="text-lg text-gray-900">
                    {allQuestions.filter((q: QuestionItem) => q.reaction === 'up').length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbDownIcon size={20} /></span>
                  <span className="text-lg text-gray-900">
                    {allQuestions.filter((q: QuestionItem) => q.reaction === 'down').length}
                  </span>
                </div>
              </div>
              <span className="block text-xs" style={{ color: COLORS.textTertiary }}>Reactions</span>
            </div>
          </div>
        </div>
        ) : !evaluation.hideOverview ? (
        <div className={CLS.cardCompact} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <KPIItem
              value={totalQuestions.toLocaleString()}
              label="Total questions"
            />
            <KPIItem
              value={`${answeredCount.toLocaleString()} (${answeredPct}%)`}
              label="Answered questions"
            />
            <KPIItem
              value={`${unansweredCount.toLocaleString()} (${100 - answeredPct}%)`}
              label="Unanswered questions"
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbUpIcon size={20} /></span>
                  <span className="text-lg text-gray-900">
                    {evaluation.thumbsUp || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbDownIcon size={20} /></span>
                  <span className="text-lg text-gray-900">
                    {evaluation.thumbsDown || 0}
                  </span>
                </div>
              </div>
              <span className="block text-xs" style={{ color: COLORS.textTertiary }}>Reactions</span>
            </div>
          </div>
        </div>
        ) : null}

        {/* Questions/Responses Grid */}
        <section className={`${CLS.card} overflow-hidden`}>
          <div className="flex items-center justify-between p-3 pb-2 min-h-[48px]">
            <label className="text-sm font-semibold text-gray-900">{mode === 'comments' ? 'Comments' : mode === 'responses' ? 'Agent responses' : 'Questions'} ({questions.length})</label>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', flexWrap: 'wrap', padding: '0 12px' }}>
            {/* Date filter */}
            <FilterMenu options={[{value:'all',label:'All time'},{value:'7days',label:'Last 7 days'},{value:'14days',label:'Last 14 days'},{value:'30days',label:'Last 30 days'}]} value={dateFilter} onChange={(v) => { setDateFilter(v); setCurrentPage(1) }} label="Date" />

            {/* Status filter - hidden in comments/responses mode */}
            {mode !== 'comments' && mode !== 'responses' && (
            <FilterMenu options={[{value:'all',label:'All'},{value:'answered',label:'Answered'},{value:'unanswered',label:'Unanswered'}]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1) }} label="Status" />
            )}

            {/* Quality filter - hidden in comments/responses mode */}
            {mode !== 'comments' && mode !== 'responses' && (
            <FilterMenu options={[{value:'all',label:'All'},{value:'good',label:'Good'},{value:'poor',label:'Poor'}]} value={qualityFilter} onChange={(v) => { setQualityFilter(v); setCurrentPage(1) }} label="Quality" />
            )}

            {/* Reactions filter */}
            <FilterMenu options={[{value:'all',label:'All'},{value:'up',label:'Thumbs up'},{value:'down',label:'Thumbs down'}]} value={reactionFilter} onChange={(v) => { setReactionFilter(v); setCurrentPage(1) }} label="Reactions" />

            {/* Comments filter */}
            {mode !== 'comments' && (
            <FilterMenu options={[{value:'all',label:'All'},{value:'with',label:'With comments'},{value:'without',label:'No comments'}]} value={commentFilter} onChange={(v) => { setCommentFilter(v); setCurrentPage(1) }} label="Comments" />
            )}

            {/* Knowledge source filter - hidden in comments/responses mode */}
            {mode !== 'comments' && mode !== 'responses' && (
            <FilterMenu options={[{value:'all',label:'All'}, ...allSources.map(source => ({value:source,label:source}))]} value={sourceFilter} onChange={(v) => { setSourceFilter(v); setCurrentPage(1) }} label="Knowledge source" />
            )}

            {hasActiveFilters && (
              <CopilotButton
                variant="ghost"
                size="xs"
                onClick={() => { setStatusFilter('all'); setQualityFilter('all'); setReactionFilter('all'); setCommentFilter('all'); setSourceFilter('all'); setDateFilter('all'); setSearchQuery(''); setCurrentPage(1) }}
                style={{ marginLeft: '4px' }}
              >
                <Dismiss12Regular /> Clear
              </CopilotButton>
            )}

            {/* Search - pushed to right */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              {searchOpen ? (
                <CopilotInput
                  size="sm"
                  placeholder={mode === 'comments' ? "Search comments..." : mode === 'responses' ? "Search responses..." : "Search questions..."}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                  contentBefore={<Search20Regular style={{ fontSize: '16px' }} />}
                  contentAfter={
                    <Dismiss12Regular
                      style={{ cursor: 'pointer', color: COLORS.fg3 }}
                      onClick={() => { setSearchOpen(false); setSearchQuery(''); setCurrentPage(1) }}
                    />
                  }
                  style={{ width: '200px' }}
                  autoFocus
                />
              ) : (
                <CopilotButton
                  variant="icon-subtle"
                  size="xs"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                >
                  <Search20Regular />
                </CopilotButton>
              )}
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="overflow-x-auto" data-hide-scrollbar="true">
              {/* Table Header */}
              <div className="flex bg-[hsl(var(--surface-secondary))] min-h-[36px] items-center">
                {(mode === 'comments' || mode === 'responses') ? (
                  <>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 4, minWidth: '120px', paddingLeft: '16px' }}>{mode === 'responses' ? 'Agent response' : 'Comment'}</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 1, minWidth: '80px' }}>Date</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 1, minWidth: '80px', paddingRight: '16px' }}>Reactions</div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 3, minWidth: '120px', paddingLeft: '16px' }}>Question</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 0.8, minWidth: '70px' }}>Status</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 1, minWidth: '80px' }}>Response quality</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 0.8, minWidth: '70px' }}>Reactions</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 1.5, minWidth: '100px' }}>Knowledge sources</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2" style={{ flex: 0.8, minWidth: '70px', paddingRight: '16px' }}>Date</div>
                  </>
                )}
              </div>

              {/* Table Rows */}
              {currentQuestions.map((result: QuestionItem, idx: number) => {
                const isAnswered = result.answered !== false
                const qualityPct = isAnswered ? (() => {
                  const scores = Object.values(result.testScores || {})
                  if (scores.length === 0) return 50
                  const passCount = scores.filter(s => s === 'Pass').length
                  return Math.round((passCount / scores.length) * 100)
                })() : null

                return (
                  <div key={idx} className="flex border-b border-[rgba(0,0,0,0.06)] min-h-[44px] items-center hover:bg-[hsl(var(--surface-secondary))] transition-colors" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onQuestionSelect?.(result); }}>
                    {(mode === 'comments' || mode === 'responses') ? (
                      <>
                        {/* Comment / Agent response text */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 4, minWidth: '120px', paddingLeft: '16px' }}>
                          <span className="text-xs text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: COLORS.textPrimary }}>
                            {mode === 'responses' ? (result.agentResponse || result.question) : result.question}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 1, minWidth: '80px' }}>
                          <span className="text-[11px] text-gray-500" style={{ color: COLORS.textSecondary }}>
                            {result.date || '\u2014'}
                          </span>
                        </div>

                        {/* Reactions */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 1, minWidth: '80px', paddingRight: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {result.reaction === 'up' && (
                              <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbUpIcon /></span>
                            )}
                            {result.reaction === 'down' && (
                              <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbDownIcon /></span>
                            )}
                            {result.comment && (
                              <Tooltip content={result.comment} relationship="label">
                                <span style={{ color: COLORS.fg3, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CommentIcon /></span>
                              </Tooltip>
                            )}
                            {!result.reaction && !result.comment && (
                              <span style={{ fontSize: '12px', color: COLORS.fgSubtle }}>{'\u2014'}</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Question */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 3, minWidth: '120px', paddingLeft: '16px' }}>
                          <span className="text-xs text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: COLORS.textPrimary }}>
                            {result.question}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 0.8, minWidth: '70px' }}>
                          <StatusBadge variant={isAnswered ? 'success' : 'danger'}>{isAnswered ? 'Answered' : 'Unanswered'}</StatusBadge>
                        </div>

                        {/* Response Quality */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 1, minWidth: '80px' }}>
                          <QualityBadge value={isAnswered ? qualityPct : null} />
                        </div>

                        {/* Reactions */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 0.8, minWidth: '70px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {result.reaction === 'up' && (
                              <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbUpIcon /></span>
                            )}
                            {result.reaction === 'down' && (
                              <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbDownIcon /></span>
                            )}
                            {result.comment && (
                              <Tooltip content={result.comment} relationship="label">
                                <span style={{ color: COLORS.fg3, display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CommentIcon /></span>
                              </Tooltip>
                            )}
                            {!result.reaction && !result.comment && (
                              <span style={{ fontSize: '12px', color: COLORS.fgSubtle }}>{'\u2014'}</span>
                            )}
                          </div>
                        </div>

                        {/* Knowledge Sources */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 1.5, minWidth: '100px', overflow: 'hidden' }} onClick={(e) => { e.stopPropagation(); onQuestionSelect?.(result); }}>
                          {result.knowledgeSources && result.knowledgeSources.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '4px', overflow: 'hidden' }}>
                              {result.knowledgeSources.map((source: string, sIdx: number) => (
                                <span key={sIdx} style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  backgroundColor: COLORS.bg4,
                                  color: COLORS.fg2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 1,
                                  minWidth: 0,
                                }}>
                                  {source}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: COLORS.fgSubtle }}>{'\u2014'}</span>
                          )}
                        </div>

                        {/* Date */}
                        <div className="text-xs text-gray-700 px-3 py-2 truncate" style={{ flex: 0.8, minWidth: '70px', paddingRight: '16px' }}>
                          <span className="text-[11px] text-gray-500" style={{ color: COLORS.textSecondary }}>
                            {result.date || '\u2014'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer / Pagination */}
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={questions.length} startIndex={startIndex} endIndex={endIndex} onPageChange={setCurrentPage} />
          </div>
        </section>
       </div>
      </div>

    </div>
  )
}

export default ThemeDetailPage
