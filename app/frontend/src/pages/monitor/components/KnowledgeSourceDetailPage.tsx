import React, { useState } from 'react'
import {
  Tooltip,
} from '@fluentui/react-components'
import {
  Search20Regular,
  Dismiss12Regular,
  ArrowDownload20Regular,
} from '@fluentui/react-icons'
import { COLORS, CLS } from '../constants'
import { DetailPageHeader, KPIItem, StatusBadge, FilterMenu, Pagination, PercentageBadge } from './SharedComponents'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import type { KnowledgeSource, Question } from '../types'

// Mock questions for each knowledge source
const KNOWLEDGE_SOURCE_QUESTIONS = {
  1: [
    { question: 'What documents do I need to bring on my first day?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/25/26', responseQuality: 95 },
    { question: 'How do I set up my company email?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Very helpful', date: '03/25/26', responseQuality: 92 },
    { question: 'Where can I find the employee handbook?', answered: true, testScores: { quality: 'Pass', relevance: 'Fail' }, reaction: 'down', comment: 'Outdated link', date: '03/24/26', responseQuality: 45 },
    { question: 'What is the dress code policy?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/24/26', responseQuality: 88 },
    { question: 'How do I enroll in benefits during onboarding?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/23/26', responseQuality: 91 },
    { question: 'Who is my onboarding buddy?', answered: false, testScores: {}, reaction: 'down', comment: 'No answer at all', date: '03/23/26', responseQuality: 0 },
    { question: 'What training sessions are available for new hires?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/22/26', responseQuality: 87 },
    { question: 'How do I get my building access badge?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Quick answer', date: '03/22/26', responseQuality: 94 },
    { question: 'What is the probation period duration?', answered: true, testScores: { quality: 'Fail', relevance: 'Fail' }, reaction: 'down', comment: 'Wrong information', date: '03/21/26', responseQuality: 30 },
    { question: 'How do I access the learning management system?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/21/26', responseQuality: 89 },
    { question: 'What is the org structure for my department?', answered: false, testScores: {}, reaction: null, comment: null, date: '03/20/26', responseQuality: 0 },
    { question: 'Can I work remotely during onboarding week?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/20/26', responseQuality: 85 },
  ],
  2: [
    { question: 'How many vacation days do I get per year?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/25/26', responseQuality: 96 },
    { question: 'Can I carry over unused PTO to next year?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Clear answer', date: '03/25/26', responseQuality: 93 },
    { question: 'What is the process for requesting extended leave?', answered: true, testScores: { quality: 'Pass', relevance: 'Fail' }, reaction: 'down', comment: 'Missing steps', date: '03/24/26', responseQuality: 55 },
    { question: 'Do holidays count against my PTO balance?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/24/26', responseQuality: 90 },
    { question: 'How far in advance should I request vacation?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/23/26', responseQuality: 88 },
    { question: 'What happens to my PTO if I leave the company?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/23/26', responseQuality: 91 },
    { question: 'Is there a sick leave policy separate from PTO?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Great detail', date: '03/22/26', responseQuality: 94 },
    { question: 'Can I take unpaid leave?', answered: true, testScores: { quality: 'Fail', relevance: 'Pass' }, reaction: 'down', comment: 'Incomplete', date: '03/22/26', responseQuality: 40 },
    { question: 'How does parental leave work?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/21/26', responseQuality: 92 },
    { question: 'What is the bereavement leave policy?', answered: false, testScores: {}, reaction: 'down', comment: 'Should have this info', date: '03/21/26', responseQuality: 0 },
  ],
  3: [
    { question: 'What health insurance options are available?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/25/26', responseQuality: 94 },
    { question: 'When is open enrollment?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/24/26', responseQuality: 90 },
    { question: 'How do I add a dependent to my plan?', answered: true, testScores: { quality: 'Pass', relevance: 'Fail' }, reaction: 'down', comment: 'Missing form link', date: '03/24/26', responseQuality: 52 },
    { question: 'What is the dental coverage?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/23/26', responseQuality: 88 },
    { question: 'Does the company offer life insurance?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/23/26', responseQuality: 85 },
    { question: 'How do I file an insurance claim?', answered: false, testScores: {}, reaction: 'down', comment: 'No answer provided', date: '03/22/26', responseQuality: 0 },
    { question: 'What is the 401k match percentage?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Accurate', date: '03/22/26', responseQuality: 96 },
    { question: 'Can I change my benefits mid-year?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/21/26', responseQuality: 87 },
  ],
  4: [
    { question: 'How do I reset my password?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/25/26', responseQuality: 95 },
    { question: 'My VPN is not connecting, what should I do?', answered: true, testScores: { quality: 'Fail', relevance: 'Fail' }, reaction: 'down', comment: 'Generic answer', date: '03/25/26', responseQuality: 25 },
    { question: 'How do I install approved software?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/24/26', responseQuality: 82 },
    { question: 'My laptop is running slow, any tips?', answered: true, testScores: { quality: 'Pass', relevance: 'Fail' }, reaction: 'down', comment: 'Too vague', date: '03/24/26', responseQuality: 45 },
    { question: 'How do I set up dual monitors?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/23/26', responseQuality: 90 },
    { question: 'What is the process for requesting new hardware?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/23/26', responseQuality: 78 },
    { question: 'How do I connect to the office printer?', answered: false, testScores: {}, reaction: 'down', comment: 'No instructions', date: '03/22/26', responseQuality: 0 },
    { question: 'My email is not syncing on mobile', answered: true, testScores: { quality: 'Fail', relevance: 'Pass' }, reaction: 'down', comment: 'Outdated steps', date: '03/22/26', responseQuality: 35 },
    { question: 'How do I get admin access to a shared drive?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/21/26', responseQuality: 80 },
    { question: 'What antivirus software does the company use?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/21/26', responseQuality: 88 },
  ],
  5: [
    { question: 'When is the next pay cycle?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/25/26', responseQuality: 97 },
    { question: 'How do I update my direct deposit information?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Step-by-step', date: '03/25/26', responseQuality: 95 },
    { question: 'What deductions appear on my payslip?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/24/26', responseQuality: 92 },
    { question: 'How does the annual bonus work?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Comprehensive', date: '03/24/26', responseQuality: 94 },
    { question: 'What is the salary review timeline?', answered: true, testScores: { quality: 'Pass', relevance: 'Fail' }, reaction: 'down', comment: 'Vague timeline', date: '03/23/26', responseQuality: 48 },
    { question: 'How do I view my pay stubs online?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/23/26', responseQuality: 90 },
    { question: 'Is overtime pay available for salaried employees?', answered: false, testScores: {}, reaction: 'down', comment: 'Needs coverage', date: '03/22/26', responseQuality: 0 },
    { question: 'How do I submit an expense report?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: null, date: '03/22/26', responseQuality: 91 },
    { question: 'What is the company stock purchase plan?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: null, comment: null, date: '03/21/26', responseQuality: 86 },
    { question: 'How do I report a payroll discrepancy?', answered: true, testScores: { quality: 'Pass', relevance: 'Pass' }, reaction: 'up', comment: 'Clear process', date: '03/21/26', responseQuality: 93 },
  ],
}


// Thumbs icons
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

interface KnowledgeSourceDetailPageProps {
  source: KnowledgeSource
  onBack: () => void
  onQuestionSelect?: (question: Question) => void
}

function KnowledgeSourceDetailPage({ source, onBack, onQuestionSelect }: KnowledgeSourceDetailPageProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')
  const [reactionFilter, setReactionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const itemsPerPage = 10

  if (!source) return null

  const allQuestions = (KNOWLEDGE_SOURCE_QUESTIONS as Record<number, any[]>)[source.id] || []

  // Apply filters
  const questions = allQuestions.filter(q => {
    if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (statusFilter !== 'all') {
      const isAnswered = q.answered !== false
      if (statusFilter === 'answered' && !isAnswered) return false
      if (statusFilter === 'unanswered' && isAnswered) return false
    }
    if (qualityFilter !== 'all') {
      if (qualityFilter === 'good' && q.responseQuality < 70) return false
      if (qualityFilter === 'poor' && q.responseQuality >= 50) return false
    }
    if (reactionFilter !== 'all') {
      if (reactionFilter === 'up' && q.reaction !== 'up') return false
      if (reactionFilter === 'down' && q.reaction !== 'down') return false
    }
    if (dateFilter !== 'all') {
      if (!q.date) return false
      const today = new Date(2026, 2, 27)
      const parts = q.date.split('/')
      const qDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
      const diffDays = Math.floor((today.getTime() - qDate.getTime()) / (1000 * 60 * 60 * 24))
      if (dateFilter === '7days' && diffDays > 7) return false
      if (dateFilter === '14days' && diffDays > 14) return false
      if (dateFilter === '30days' && diffDays > 30) return false
    }
    return true
  })

  const hasActiveFilters = statusFilter !== 'all' || qualityFilter !== 'all' || reactionFilter !== 'all' || dateFilter !== 'all' || searchQuery !== ''

  // Pagination
  const totalPages = Math.ceil(questions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentQuestions = questions.slice(startIndex, endIndex)

  // KPI calculations
  const answeredCount = allQuestions.filter(q => q.answered).length
  const answeredPct = Math.round((answeredCount / allQuestions.length) * 100)
  const avgQuality = Math.round(allQuestions.filter(q => q.answered && q.responseQuality > 0).reduce((sum, q) => sum + q.responseQuality, 0) / allQuestions.filter(q => q.answered && q.responseQuality > 0).length)
  const thumbsUpCount = allQuestions.filter(q => q.reaction === 'up').length
  const thumbsDownCount = allQuestions.filter(q => q.reaction === 'down').length

  return (
    <div className={CLS.pageRoot}>
      <div className={`${CLS.pageInner} pt-2.5`}>
        <div className="max-w-full mx-auto">
        {/* Header */}
        <DetailPageHeader title={source.name} onBack={onBack}>
          <CopilotButton variant="ghost" size="xs">
            <ArrowDownload20Regular /> Download
          </CopilotButton>
        </DetailPageHeader>
        <div className="mb-2.5" style={{ marginTop: '-4px' }}>
          {/* Type badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span className="inline-flex items-center h-5 px-2 rounded-md border border-[rgba(0,0,0,0.09)] text-[11px] text-gray-500" style={{ borderColor: COLORS.strokeLight }}>
              {source.type}
            </span>
          </div>
        </div>

        {/* KPI Overview */}
        <div className={CLS.cardCompact} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <KPIItem value={source.totalQuestions.toLocaleString()} label="Total questions" />
            <KPIItem value={`${answeredPct}%`} label="Answered" />
            <div>
              <div style={{ marginBottom: '2px' }}>
                <PercentageBadge value={avgQuality} label={`${avgQuality}%`} highThreshold={85} midThreshold={70} />
              </div>
              <span className="block text-xs" style={{ color: COLORS.textTertiary }}>Response quality</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbUpIcon size={16} /></span>
                  <span className="text-lg text-gray-900">{thumbsUpCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: COLORS.fg2, display: 'flex', alignItems: 'center' }}><ThumbDownIcon size={16} /></span>
                  <span className="text-lg text-gray-900">{thumbsDownCount}</span>
                </div>
              </div>
              <span className="block text-xs text-gray-500">Reactions</span>
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        <section className={`${CLS.card} overflow-hidden`}>
          <div className="flex items-center justify-between p-3 pb-2 min-h-[48px]">
            <label className="text-sm font-semibold text-gray-900">Questions ({questions.length})</label>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', flexWrap: 'wrap', padding: '0 12px' }}>
            <FilterMenu options={[{value:'all',label:'All time'},{value:'7days',label:'Last 7 days'},{value:'14days',label:'Last 14 days'},{value:'30days',label:'Last 30 days'}]} value={dateFilter} onChange={(v) => { setDateFilter(v); setCurrentPage(1) }} label="Date" />
            <FilterMenu options={[{value:'all',label:'All'},{value:'answered',label:'Answered'},{value:'unanswered',label:'Unanswered'}]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1) }} label="Status" />
            <FilterMenu options={[{value:'all',label:'All'},{value:'good',label:'Good'},{value:'poor',label:'Poor'}]} value={qualityFilter} onChange={(v) => { setQualityFilter(v); setCurrentPage(1) }} label="Quality" />
            <FilterMenu options={[{value:'all',label:'All'},{value:'up',label:'Thumbs up'},{value:'down',label:'Thumbs down'}]} value={reactionFilter} onChange={(v) => { setReactionFilter(v); setCurrentPage(1) }} label="Reactions" />

            {hasActiveFilters && (
              <CopilotButton
                variant="ghost"
                size="xs"
                onClick={() => { setStatusFilter('all'); setQualityFilter('all'); setReactionFilter('all'); setDateFilter('all'); setSearchQuery(''); setCurrentPage(1) }}
                style={{ marginLeft: '4px' }}
              >
                <Dismiss12Regular /> Clear
              </CopilotButton>
            )}

            {/* Search */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              {searchOpen ? (
                <div style={{ width: '200px' }}>
                  <CopilotInput
                    size="sm"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                    autoFocus
                    contentBefore={<Search20Regular style={{ fontSize: '16px' }} />}
                    contentAfter={
                      <span style={{ cursor: 'pointer', color: COLORS.fg3, display: 'flex', alignItems: 'center' }}
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); setCurrentPage(1) }}
                      >
                        <Dismiss12Regular />
                      </span>
                    }
                  />
                </div>
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

          <div>
            <div data-hide-scrollbar="true">
              {/* Table Header */}
              <div className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center">
                <div className="px-2 text-[11px] text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center" style={{ flex: 3, minWidth: '120px', paddingLeft: '16px' }}>Question</div>
                <div className="px-2 text-[11px] text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center" style={{ flex: 0.8, minWidth: '70px' }}>Status</div>
                <div className="px-2 text-[11px] text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center" style={{ flex: 1, minWidth: '80px' }}>Response quality</div>
                <div className="px-2 text-[11px] text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center" style={{ flex: 0.8, minWidth: '70px' }}>Reactions</div>
                <div className="px-2 text-[11px] text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center" style={{ flex: 0.8, minWidth: '70px', paddingRight: '16px' }}>Date</div>
              </div>

              {/* Table Rows */}
              {currentQuestions.map((result, idx) => {
                const isAnswered = result.answered !== false

                return (
                  <div key={idx} className="flex bg-white min-h-[44px] hover:bg-[hsl(var(--surface-secondary))] cursor-pointer" onClick={() => onQuestionSelect?.(result)}>
                    {/* Question */}
                    <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px]" style={{ flex: 3, minWidth: '120px', paddingLeft: '16px' }}>
                      <span className="text-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {result.question}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px]" style={{ flex: 0.8, minWidth: '70px' }}>
                      <StatusBadge variant={isAnswered ? 'success' : 'danger'}>{isAnswered ? 'Answered' : 'Unanswered'}</StatusBadge>
                    </div>

                    {/* Response Quality */}
                    <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px]" style={{ flex: 1, minWidth: '80px' }}>
                      {isAnswered ? <PercentageBadge value={result.responseQuality} label={`${result.responseQuality}%`} highThreshold={85} midThreshold={70} /> : <span style={{ fontSize: '12px', color: COLORS.fgSubtle }}>—</span>}
                    </div>

                    {/* Reactions */}
                    <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px]" style={{ flex: 0.8, minWidth: '70px' }}>
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
                          <span style={{ fontSize: '12px', color: COLORS.fgSubtle }}>—</span>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px]" style={{ flex: 0.8, minWidth: '70px', paddingRight: '16px' }}>
                      <span className="text-[11px] text-gray-500">
                        {result.date || '—'}
                      </span>
                    </div>
                  </div>
                )
              })}

              {currentQuestions.length === 0 && (
                <div style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span className="text-xs text-gray-500">No questions match the current filters</span>
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={questions.length}
              startIndex={startIndex + 1}
              endIndex={Math.min(endIndex, questions.length)}
              onPageChange={setCurrentPage}
            />
          )}
        </section>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeSourceDetailPage
