import React, { useState } from 'react'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
} from '@fluentui/react-components'
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '../../../components/ui/Dialog'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import {
  MoreHorizontal20Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Sparkle20Regular,
} from '@fluentui/react-icons'
import { PercentageBadge } from './SharedComponents'
import { COLORS } from '../constants'
import type { Evaluation, Dataset, Agent, KnowledgeSource } from '../types'

// ─── Score Badge ────────────────────────────────────────────────────────────
// Renders a colored percentage badge based on score thresholds.
const SCORE_BANDS = [
  { min: 80, bg: 'bg-green-50', text: 'text-green-700' },
  { min: 60, bg: 'bg-[rgba(140,195,83,0.1)]', text: 'text-[#498205]' },
  { min: 40, bg: 'bg-[rgba(253,227,0,0.1)]', text: 'text-[#8a7000]' },
  { min: 20, bg: 'bg-[rgba(247,99,12,0.1)]', text: 'text-[#ca5010]' },
  { min: 0,  bg: 'bg-red-50', text: 'text-[#ca5010]' },
]

interface ScoreBadgeProps {
  score: number
  maxScore: number
}

function ScoreBadge({ score, maxScore }: ScoreBadgeProps) {
  const percentage = Math.round((score / maxScore) * 100)
  const band = SCORE_BANDS.find(b => percentage >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1]

  return (
    <div className={`flex items-center gap-2 px-2.5 rounded-md h-8 w-full ${band.bg}`}>
      <span className={`font-semibold text-xs ${band.text}`}>
        {percentage}%
      </span>
    </div>
  )
}

// ─── Evaluated Item Badge ───────────────────────────────────────────────────
interface EvaluatedItemBadgeProps {
  type: string
  name: string
  icon: string
  dataType: string
}

function EvaluatedItemBadge({ type, name, icon, dataType }: EvaluatedItemBadgeProps) {
  const getTooltipText = () => {
    if (type === 'Agent' && dataType) return `Agent: ${dataType}`
    return type
  }

  return (
    <Tooltip content={getTooltipText()} relationship="label">
      <span className="inline-flex items-center gap-1 h-5 min-w-[20px] max-w-full px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500 overflow-hidden">
        {icon && <img src={icon} alt={name} width="16" height="16" className="flex-shrink-0" />}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
      </span>
    </Tooltip>
  )
}


// ─── Evaluations Grid (Themes) ──────────────────────────────────────────────
interface EvaluationsGridProps {
  data: Evaluation[]
  onEvaluationClick: (item: Evaluation) => void
  onTrackTheme: (item: Evaluation) => void
  onEditTheme: (item: Evaluation) => void
  onDeleteTheme: (id: string) => void
  onShowMetrics?: (item: Evaluation) => void
  onEvaluate?: (item: Evaluation) => void
}

function EvaluationsGrid({ data, onEvaluationClick, onTrackTheme, onEditTheme, onDeleteTheme, onShowMetrics, onEvaluate }: EvaluationsGridProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Evaluation | null>(null)
  const itemsPerPage = 5
  const totalPages = Math.ceil(data.length / itemsPerPage)

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.slice(startIndex, endIndex)

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto" data-hide-scrollbar="true">
        {/* Header */}
        <div className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center">
          <div className="flex-[2] min-w-[120px] pl-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Name</div>
          <div className="flex-1 min-w-[80px] px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Category</div>
          <div className="flex-1 min-w-[80px] px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center"># of questions</div>
          <div className="flex-1 min-w-[80px] px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Answered questions</div>
          <div className="flex-1 min-w-[90px] px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Response quality</div>
          <div className="flex-1 min-w-[80px] px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Reactions</div>
          <div className="flex-1 min-w-[70px] pr-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Type</div>
        </div>

        {/* Rows */}
        {currentData.map((item) => (
          <div
            key={item.id}
            className="flex bg-white min-h-[44px] hover:bg-[hsl(var(--surface-secondary))] cursor-pointer relative"
            onClick={() => onEvaluationClick(item)}
            onMouseEnter={() => setHoveredRowId(item.id)}
            onMouseLeave={() => setHoveredRowId(null)}
          >
            <div className="flex-[2] min-w-[120px] pl-6 pr-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between h-[44px] overflow-hidden relative">
              <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-gray-900">{item.name}</span>
              <div className="w-8 flex items-center justify-start -mr-2">
                {hoveredRowId === item.id && (
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <button
                        type="button"
                        className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="More options"
                      >
                        <MoreHorizontal20Regular className="w-5 h-5 text-gray-600" />
                      </button>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem onClick={(e) => { e.stopPropagation(); onShowMetrics?.(item) }}>See details</MenuItem>
                        <MenuItem onClick={(e) => { e.stopPropagation(); onEvaluate?.(item) }}>Evaluate</MenuItem>
                        <MenuItem onClick={(e) => { e.stopPropagation(); onEditTheme(item) }}>{item.evaluatedItem?.type === 'tracked' ? 'Edit' : 'Edit & Track'}</MenuItem>
                        <MenuItem onClick={(e) => { e.stopPropagation(); setDeleteConfirmItem(item) }} style={{ color: COLORS.dangerText }}>Delete</MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[80px] px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-1.5 flex-wrap h-[44px] overflow-hidden">
              {(item.categories?.length ?? 0) > 0 ? item.categories!.map((cat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center h-5 px-2 rounded-md border border-[rgba(0,0,0,0.06)] text-[11px] text-gray-500"
                >
                  {cat}
                </span>
              )) : <span>—</span>}
            </div>
            <div className="flex-1 min-w-[80px] px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span>{item.totalTestCases || 0}</span>
            </div>
            <div className="flex-1 min-w-[80px] px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span>{item.answeredQuestions || '0%'}</span>
            </div>
            <div className="flex-1 min-w-[90px] px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              {item.responseQuality && (
                <PercentageBadge value={parseInt(item.responseQuality)} label={item.responseQuality} />
              )}
            </div>
            <div className="flex-1 min-w-[80px] px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-4 h-[44px] overflow-hidden">
              <div className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.052 2.29418C10.3913 1.31688 11.6841 0.866611 12.4829 1.70374C12.6455 1.87416 12.8081 2.05832 12.9176 2.22254C13.2379 2.70305 13.3725 3.33584 13.4218 3.9522C13.4721 4.58034 13.438 5.25446 13.3738 5.86473C13.3093 6.47735 13.2129 7.03948 13.1328 7.44766C13.1294 7.46535 13.1259 7.48277 13.1225 7.49989H14.006C15.8777 7.49989 17.2924 9.19503 16.9576 11.0365L16.2737 14.7983C15.8017 17.3942 13.2078 19.0289 10.6622 18.3347L5.06251 16.8075C4.14894 16.5583 3.45455 15.8144 3.26885 14.8859L2.91581 13.1207C2.63809 11.7321 3.69991 10.5623 4.82905 10.116C5.15163 9.9885 5.44337 9.82668 5.66974 9.62586C7.37583 8.11234 7.99442 6.90276 9.05406 4.77684C9.4084 4.06594 9.77205 3.10043 10.052 2.29418ZM12.0165 7.87851L12.0169 7.87696L12.0187 7.86962L12.0262 7.83852C12.0328 7.81068 12.0426 7.76892 12.0549 7.71482C12.0793 7.60658 12.1135 7.44919 12.1515 7.25525C12.2277 6.86655 12.3188 6.33493 12.3793 5.76005C12.4401 5.18282 12.4685 4.57569 12.425 4.03195C12.3806 3.47644 12.2652 3.04673 12.0855 2.77724C12.0264 2.68859 11.9138 2.55593 11.7594 2.3941C11.5605 2.18565 11.1314 2.23417 10.9967 2.62217C10.7141 3.43598 10.3334 4.45183 9.94904 5.22294C8.88216 7.36338 8.19326 8.72396 6.33336 10.3739C5.99304 10.6758 5.58878 10.891 5.19665 11.046C4.31631 11.394 3.75035 12.1944 3.89639 12.9246L4.24943 14.6898C4.36085 15.2469 4.77748 15.6932 5.32562 15.8427L10.9254 17.3699C12.9052 17.9099 14.9227 16.6384 15.2898 14.6194L15.9738 10.8577C16.197 9.62998 15.2538 8.49989 14.006 8.49989H12.5015C12.3476 8.49989 12.2022 8.42895 12.1074 8.3076C12.0127 8.18627 11.9792 8.02785 12.0165 7.87851C12.0165 7.87847 12.0165 7.87855 12.0165 7.87851Z" fill="#424242"/>
                </svg>
                <span className="text-[11px] text-gray-600">{item.thumbsUp || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.052 17.7057C10.3913 18.683 11.6841 19.1333 12.4829 18.2962C12.6455 18.1257 12.8081 17.9416 12.9176 17.7774C13.2379 17.2968 13.3725 16.6641 13.4218 16.0477C13.4721 15.4195 13.438 14.7454 13.3738 14.1352C13.3093 13.5225 13.2129 12.9604 13.1328 12.5522C13.1294 12.5345 13.1259 12.5171 13.1225 12.5H14.006C15.8777 12.5 17.2924 10.8049 16.9576 8.96334L16.2737 5.20164C15.8017 2.60569 13.2078 0.970952 10.6622 1.66519L5.06251 3.19239C4.14894 3.44154 3.45455 4.18547 3.26885 5.11401L2.91581 6.87918C2.63809 8.2678 3.69991 9.43756 4.82905 9.88388C5.15163 10.0114 5.44337 10.1732 5.66974 10.374C7.37583 11.8875 7.99442 13.0971 9.05406 15.2231C9.4084 15.9339 9.77205 16.8995 10.052 17.7057ZM12.0165 12.1214L12.0169 12.1229L12.0187 12.1303L12.0262 12.1614C12.0328 12.1892 12.0426 12.231 12.0549 12.2851C12.0793 12.3933 12.1135 12.5507 12.1515 12.7446C12.2277 13.1333 12.3188 13.665 12.3793 14.2398C12.4401 14.8171 12.4685 15.4242 12.425 15.9679C12.3806 16.5235 12.2652 16.9532 12.0855 17.2227C12.0264 17.3113 11.9138 17.444 11.7594 17.6058C11.5605 17.8142 11.1314 17.7657 10.9967 17.3777C10.7141 16.5639 10.3334 15.5481 9.94904 14.777C8.88216 12.6365 8.19326 11.2759 6.33336 9.62597C5.99304 9.32406 5.58878 9.1089 5.19665 8.9539C4.31631 8.60592 3.75035 7.80549 3.89639 7.0753L4.24943 5.31013C4.36085 4.753 4.77748 4.30665 5.32562 4.15715L10.9254 2.62995C12.9052 2.08999 14.9227 3.36145 15.2898 5.38053L15.9738 9.14223C16.197 10.3699 15.2538 11.5 14.006 11.5H12.5015C12.3476 11.5 12.2022 11.5709 12.1074 11.6923C12.0127 11.8136 11.9792 11.972 12.0165 12.1214C12.0165 12.1214 12.0165 12.1213 12.0165 12.1214Z" fill="#424242"/>
                </svg>
                <span className="text-[11px] text-gray-600">{item.thumbsDown || 0}</span>
              </div>
            </div>
            <div className="flex-1 min-w-[70px] pr-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="inline-flex items-center gap-1 h-5 min-w-[20px] max-w-full px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500 overflow-hidden">
                <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center">
                  {item.evaluatedItem?.type === 'tracked' ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" />
                    </svg>
                  ) : (
                    <Sparkle20Regular style={{ width: '14px', height: '14px' }} />
                  )}
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.evaluatedItem?.type === 'tracked' ? 'Tracked' : 'Suggested'}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center h-9 bg-white" style={{ padding: '0 24px' }}>
        <span className="text-[11px] text-gray-400">
          {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length}
        </span>
        <div className="flex items-center gap-1">
          <CopilotButton
            variant="ghost"
            size="xs"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            aria-label="Previous page"
          >
            <ChevronLeft16Regular className="w-4 h-4" />
          </CopilotButton>
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, index) => {
              const pageNum = index + 1
              return (
                <span
                  key={pageNum}
                  className={`text-[11px] cursor-pointer ${currentPage === pageNum ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </span>
              )
            })}
          </div>
          <CopilotButton
            variant="ghost"
            size="xs"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            aria-label="Next page"
          >
            <ChevronRight16Regular className="w-4 h-4" />
          </CopilotButton>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog isOpen={!!deleteConfirmItem} onClose={() => setDeleteConfirmItem(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDeleteConfirmItem(null)}>
          <DialogTitle>Delete theme</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-body-2 text-text-secondary">Are you sure you want to delete this theme? This action cannot be undone.</p>
        </DialogContent>
        <DialogFooter>
          <CopilotButton variant="secondary" size="md" onClick={() => setDeleteConfirmItem(null)}>Cancel</CopilotButton>
          <CopilotButton variant="primary" size="md" className="bg-red-600 hover:bg-red-700" onClick={() => {
            if (deleteConfirmItem && onDeleteTheme) onDeleteTheme(deleteConfirmItem.id)
            setDeleteConfirmItem(null)
          }}>Delete</CopilotButton>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

// ─── Datasets Grid ──────────────────────────────────────────────────────────
interface DatasetsGridProps {
  data: Dataset[]
  onDatasetClick: (item: Dataset) => void
}

function DatasetsGrid({ data, onDatasetClick }: DatasetsGridProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto" data-hide-scrollbar="true">
        {/* Header */}
        <div className="grid bg-[hsl(var(--surface-secondary))] h-9 items-center " style={{ gridTemplateColumns: '2fr 0.75fr 1fr 1.5fr' }}>
          <div className="pl-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Name</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Amount</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Data type</div>
          <div className="pr-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Last modified by</div>
        </div>

        {/* Rows */}
        {data.map((item) => (
          <div
            key={item.id}
            className="grid bg-white min-h-[44px] hover:bg-[hsl(var(--surface-secondary))] cursor-pointer"
            style={{ gridTemplateColumns: '2fr 0.75fr 1fr 1.5fr' }}
            onClick={() => onDatasetClick(item)}
          >
            <div className="pl-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-gray-900">{item.name}</span>
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              {item.amount}
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              {item.dataType}
            </div>
            <div className="pr-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                  {item.lastModifiedBy.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-900">{item.lastModifiedBy.name}</span>
                  <span className="text-[10px] text-gray-500">{item.lastModifiedBy.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Agents Grid ────────────────────────────────────────────────────────────
interface AgentsGridProps {
  data: Agent[]
  onAgentClick?: (agent: Agent) => void
}

function AgentsGrid({ data, onAgentClick }: AgentsGridProps) {
  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'copilot-studio':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <mask id="mask0_27708_68111" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="19">
              <path d="M5 2.49603C5 1.86563 5.46942 1.33388 6.09496 1.25569L13.595 0.318186C14.2854 0.23188 14.9013 0.723685 14.9893 1.39344L14.9999 1.39256C14.9999 1.98765 15.443 2.48961 16.0335 2.56343L18.9049 2.92236C19.5305 3.00055 19.9999 3.53229 19.9999 4.16269L20 10.0807C20 10.7111 19.5305 11.2429 18.905 11.3211L16.0048 11.6836C15.4248 11.7993 15.0001 12.3098 15.0001 12.9093V16.539C15.0001 17.1694 14.5307 17.7011 13.9052 17.7793L6.40514 18.7168C5.65908 18.8101 5.0001 18.2283 5.0001 17.4765L5.0001 14.1466L5 14.1627V17.6426C5 17.0475 4.55687 16.5455 3.96637 16.4717L1.09496 16.1128C0.469532 16.0346 0.000166452 15.503 0 14.8727L1.01517e-06 8.95437C1.08055e-06 8.32396 0.469422 7.79221 1.09496 7.71402L5 7.22589L5 2.49603Z" fill="white"/>
            </mask>
            <g mask="url(#mask0_27708_68111)">
              <path d="M15.0001 1.375C15.0001 1.96999 15.443 2.47195 16.0333 2.5459L18.9054 2.90527C19.5307 2.98363 20.0001 3.51523 20.0001 4.14551V10.0635C20 10.6937 19.5307 11.2254 18.9054 11.3037L16.0216 11.6641C15.4332 11.7733 15.0002 12.2865 15.0001 12.8916V16.5215C15.0001 17.1518 14.5309 17.6835 13.9054 17.7617L6.4054 18.6992C5.65935 18.7925 5.00016 18.2108 5.00012 17.459V11.375L10.0001 10.6602V2.94141C10.0003 2.29149 10.4989 1.75027 11.1466 1.69629L15.0001 1.375Z" fill="url(#paint0_linear_27708_68111)"/>
              <path d="M5 17.625L5 14.1452C5 13.5151 5.46889 12.9836 6.09389 12.905L3.64261e-08 13.6667L8.83635e-08 14.8549C1.15919e-07 15.4853 0.469421 16.017 1.09496 16.0952L3.96637 16.4542C4.55687 16.528 5 17.0299 5 17.625Z" fill="url(#paint1_linear_27708_68111)"/>
              <path opacity="0.5" d="M1.09496 8.1965C0.469422 8.2747 1.08055e-06 8.80645 1.01517e-06 9.43685L3.73368e-07 15.625L6.46021e-07 15.2702C1.13039e-06 14.6398 0.469422 14.108 1.09496 14.0298L8.90505 13.0536C9.53058 12.9754 10 12.4436 10 11.8132L10 7.08337L1.09496 8.1965Z" fill="black"/>
              <path opacity="0.5" fillRule="evenodd" clipRule="evenodd" d="M1.16133e-06 15.2702C1.44282e-06 14.8919 0.781655 14.5729 1.15698 14.526L8.96706 13.5497C9.84281 13.4402 10.5 12.6958 10.5 11.8132L10.5 6.51697L1.03294 7.70035C0.157191 7.80982 1.63782e-06 8.55427 1.55719e-06 9.43684L1.16133e-06 15.2702Z" fill="black" fillOpacity="0.5"/>
              <path d="M1.09496 7.6965C0.469422 7.7747 1.08055e-06 8.30645 1.01517e-06 8.93685L3.73368e-07 15.125L6.46021e-07 14.7702C1.13039e-06 14.1398 0.469422 13.608 1.09496 13.5298L8.90505 12.5536C9.53058 12.4754 10 11.9436 10 11.3132L10 6.58337L1.09496 7.6965Z" fill="url(#paint2_linear_27708_68111)"/>
              <path d="M1.09496 7.6965C0.469422 7.7747 1.08055e-06 8.30645 1.01517e-06 8.93685L3.73368e-07 15.125L6.46021e-07 14.7702C1.13039e-06 14.1398 0.469422 13.608 1.09496 13.5298L8.90505 12.5536C9.53058 12.4754 10 11.9436 10 11.3132L10 6.58337L1.09496 7.6965Z" fill="url(#paint3_linear_27708_68111)" fillOpacity="0.6"/>
              <path d="M10 11.2285L10 7.68681C10 7.05676 10.4689 6.52526 11.0939 6.4466L5 7.20833L5 8.39652C5 9.02692 5.46942 9.55868 6.09496 9.63687L8.90504 9.98813C9.53058 10.0663 10 10.5981 10 11.2285Z" fill="url(#paint4_linear_27708_68111)"/>
              <path opacity="0.5" d="M6.09496 1.73811C5.46942 1.8163 5 2.34805 5 2.97846L5 8.95831L5 8.81179C5 8.18139 5.46942 7.64963 6.09496 7.57144L13.905 6.59518C14.5306 6.51699 15 5.98524 15 5.35483L15 2.04096C15 1.28908 14.341 0.70735 13.595 0.800608L6.09496 1.73811Z" fill="black"/>
              <path opacity="0.5" fillRule="evenodd" clipRule="evenodd" d="M5 8.81094L5 2.97853C5 2.09596 5.15719 1.35151 6.03294 1.24204L13.5329 0.304543C14.5774 0.173981 15.5 0.988409 15.5 2.04103L15.5 5.35491C15.5 6.23747 14.8428 6.98192 13.9671 7.09139L6.15698 8.06765C5.78188 8.11454 5.00034 8.43299 5 8.81094Z" fill="black" fillOpacity="0.5"/>
              <path d="M6.09496 1.23813C5.46942 1.31632 5 1.84807 5 2.47848L5 8.45833L5 8.31181C5 7.68141 5.46942 7.14966 6.09496 7.07146L13.905 6.0952C14.5306 6.01701 15 5.48526 15 4.85486L15 1.54098C15 0.789106 14.341 0.207372 13.595 0.30063L6.09496 1.23813Z" fill="url(#paint5_linear_27708_68111)"/>
              <path d="M6.09496 1.23813C5.46942 1.31632 5 1.84807 5 2.47848L5 8.45833L5 8.31181C5 7.68141 5.46942 7.14966 6.09496 7.07146L13.905 6.0952C14.5306 6.01701 15 5.48526 15 4.85486L15 1.54098C15 0.789106 14.341 0.207372 13.595 0.30063L6.09496 1.23813Z" fill="url(#paint6_linear_27708_68111)" fillOpacity="0.8"/>
            </g>
            <defs>
              <linearGradient id="paint0_linear_27708_68111" x1="5.41679" y1="19.4814" x2="27.7402" y2="8.30394" gradientUnits="userSpaceOnUse">
                <stop stopColor="#003580"/>
                <stop offset="0.299454" stopColor="#0057AD"/>
                <stop offset="1" stopColor="#16BFDF"/>
              </linearGradient>
              <linearGradient id="paint1_linear_27708_68111" x1="5.09976e-08" y1="14" x2="6.66667" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0E637A"/>
                <stop offset="1" stopColor="#0074BD"/>
              </linearGradient>
              <linearGradient id="paint2_linear_27708_68111" x1="11.7857" y1="14.4956" x2="0.338629" y2="8.74426" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0986B3"/>
                <stop offset="0.721629" stopColor="#16BFDF"/>
                <stop offset="1" stopColor="#3DD9EB"/>
              </linearGradient>
              <linearGradient id="paint3_linear_27708_68111" x1="1.91237e-07" y1="10.9584" x2="1.51786" y2="10.9584" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0BA0C5"/>
                <stop offset="0.499692" stopColor="#0BA0C5" stopOpacity="0.263415"/>
                <stop offset="1" stopColor="#0BA0C5" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="paint4_linear_27708_68111" x1="3.33333" y1="9.66369" x2="10" y2="9.66369" gradientUnits="userSpaceOnUse">
                <stop stopColor="#117B97"/>
                <stop offset="1" stopColor="#1392B4"/>
              </linearGradient>
              <linearGradient id="paint5_linear_27708_68111" x1="5.625" y1="9.61968" x2="14.576" y2="0.497429" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3DCBFF"/>
                <stop offset="0.524843" stopColor="#6EEDED"/>
                <stop offset="1" stopColor="#9BF3AF"/>
              </linearGradient>
              <linearGradient id="paint6_linear_27708_68111" x1="5" y1="4.5" x2="6.60714" y2="4.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3DCBFF"/>
                <stop offset="0.433173" stopColor="#3DCBFF" stopOpacity="0.339056"/>
                <stop offset="1" stopColor="#3DCBFF" stopOpacity="0"/>
              </linearGradient>
            </defs>
          </svg>
        )
      case 'child':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_27708_68179)">
              <path d="M10 1.5C7.79086 1.5 6 3.29086 6 5.5C6 7.70914 7.79086 9.5 10 9.5C12.2091 9.5 14 7.70914 14 5.5C14 3.29086 12.2091 1.5 10 1.5ZM7 5.5C7 3.84315 8.34315 2.5 10 2.5C11.6569 2.5 13 3.84315 13 5.5C13 7.15685 11.6569 8.5 10 8.5C8.34315 8.5 7 7.15685 7 5.5ZM5.00873 10.5C3.90315 10.5 3 11.3869 3 12.5C3 14.1912 3.83281 15.4663 5.13499 16.2966C6.41697 17.114 8.14526 17.5 10 17.5C11.8547 17.5 13.583 17.114 14.865 16.2966C16.1672 15.4663 17 14.1912 17 12.5C17 11.3956 16.1045 10.5 15 10.5L5.00873 10.5ZM4 12.5C4 11.9467 4.44786 11.5 5.00873 11.5L15 11.5C15.5522 11.5 16 11.9478 16 12.5C16 13.8088 15.3777 14.7837 14.3274 15.4534C13.2568 16.136 11.7351 16.5 10 16.5C8.26489 16.5 6.74318 16.136 5.67262 15.4534C4.62226 14.7837 4 13.8088 4 12.5Z" fill="#242424"/>
            </g>
            <defs>
              <clipPath id="clip0_27708_68179">
                <rect width="20" height="20" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        )
      case 'azure-ai-foundry':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_27708_68213)">
              <g clipPath="url(#clip1_27708_68213)">
                <path d="M5.97373 1.09374C6.0931 0.740069 6.42477 0.501953 6.79805 0.501953H12.4719L6.59813 17.9057C6.47877 18.2593 6.14709 18.4975 5.77382 18.4975H1.31181C0.716617 18.4975 0.297164 17.9132 0.487496 17.3493L5.97373 1.09374Z" fill="url(#paint0_linear_27708_68213)"/>
                <path d="M14.9986 12.5203H6.13221C5.75258 12.5203 5.57461 12.9898 5.85888 13.2415L11.5504 18.2792C11.7094 18.4201 11.9146 18.4978 12.127 18.4978H17.1959L14.9986 12.5203Z" fill="#0078D4"/>
                <g opacity="0.5">
                  <path d="M13.1515 18.4978H17.1959L14.9986 12.5203H11.4205L13.1982 17.8115C13.2788 18.0513 13.2528 18.2945 13.1515 18.4978Z" fill="black"/>
                  <path d="M9.92152 8.0586L12.4719 0.501953H7.36768C7.39314 0.548317 7.41476 0.597389 7.43204 0.648816L9.92152 8.0586Z" fill="black"/>
                </g>
                <g opacity="0.5">
                  <path d="M6.55115 0.535599H6.57908C6.7508 0.535599 6.90335 0.64527 6.95804 0.808055L9.65716 8.8418L10.1858 7.2754L7.92143 0.535599H12.4605L12.4719 0.501953H6.55115V0.535599Z" fill="black" fillOpacity="0.5"/>
                  <path d="M12.2471 18.4978L17.1959 18.4978L13.6876 18.4978C13.7669 18.2337 13.7693 17.9414 13.6722 17.6522L11.948 12.5203H10.893L12.7242 17.9707C12.8113 18.2298 12.6185 18.4978 12.3453 18.4978H12.2471Z" fill="black" fillOpacity="0.5"/>
                </g>
                <path d="M14.0215 1.09411C13.9021 0.740436 13.5705 0.502319 13.1972 0.502319H6.84851H6.87738C7.26343 0.502319 7.60646 0.748586 7.72991 1.11437L13.196 17.3103C13.3929 17.8936 12.9591 18.4978 12.3435 18.4978H12.2472H18.6834C19.2786 18.4978 19.6981 17.9136 19.5077 17.3496L14.0215 1.09411Z" fill="url(#paint1_linear_27708_68213)"/>
              </g>
            </g>
            <defs>
              <linearGradient id="paint0_linear_27708_68213" x1="6.78092" y1="1.12484" x2="0.911742" y2="18.4638" gradientUnits="userSpaceOnUse">
                <stop stopColor="#114A8B"/>
                <stop offset="1" stopColor="#0669BC"/>
              </linearGradient>
              <linearGradient id="paint1_linear_27708_68213" x1="10.5021" y1="1.12523" x2="16.9446" y2="18.2896" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3CCBF4"/>
                <stop offset="1" stopColor="#2892DF"/>
              </linearGradient>
              <clipPath id="clip0_27708_68213">
                <rect width="19.9961" height="20" fill="white"/>
              </clipPath>
              <clipPath id="clip1_27708_68213">
                <rect width="19.9961" height="19.9961" fill="white" transform="translate(0 -0.498047)"/>
              </clipPath>
            </defs>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto" data-hide-scrollbar="true">
        {/* Header */}
        <div className="grid bg-[hsl(var(--surface-secondary))] h-9 items-center " style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.2fr' }}>
          <div className="pl-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Name</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Type</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Calls</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Success rate</div>
          <div className="pr-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Status</div>
        </div>

        {/* Rows */}
        {data.map((agent) => (
          <div
            key={agent.id}
            className="grid bg-white min-h-[44px] hover:bg-[hsl(var(--surface-secondary))]"
            style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.2fr', cursor: onAgentClick ? 'pointer' : undefined }}
            onClick={() => onAgentClick && onAgentClick(agent)}
          >
            <div className="pl-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-gray-900">{agent.name}</span>
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="inline-flex items-center gap-1 h-5 min-w-[20px] max-w-full px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500 overflow-hidden">
                <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center">
                  {getTypeIcon(agent.type)}
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {agent.typeName}
                </span>
              </span>
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              {agent.calls.toLocaleString()}
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <PercentageBadge value={agent.successRate} label={`${agent.successRate}%`} highThreshold={90} midThreshold={80} />
            </div>
            <div className="pr-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium ${
                agent.status === 'enabled'
                  ? 'bg-[hsl(var(--status-success)/0.15)] text-[hsl(var(--status-success))]'
                  : 'bg-[hsl(var(--status-error)/0.15)] text-[hsl(var(--status-error))]'
              }`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Knowledge Sources Grid ─────────────────────────────────────────────────
const KNOWLEDGE_SOURCES = [
  { id: 1, name: 'Employee Onboarding Guide', type: 'SharePoint', totalQuestions: 597, responseQuality: '93%', thumbsUp: 5, thumbsDown: 16 },
  { id: 2, name: 'Vacation & PTO Policy', type: 'Website', totalQuestions: 1403, responseQuality: '88%', thumbsUp: 0, thumbsDown: 0 },
  { id: 3, name: 'Benefits & Insurance Guide', type: 'File', totalQuestions: 259, responseQuality: '86%', thumbsUp: 5, thumbsDown: 0 },
  { id: 4, name: 'IT Support & Troubleshooting', type: 'SharePoint', totalQuestions: 720, responseQuality: '64%', thumbsUp: 0, thumbsDown: 16 },
  { id: 5, name: 'Compensation & Payroll Handbook', type: 'Website', totalQuestions: 1058, responseQuality: '93%', thumbsUp: 5, thumbsDown: 16 },
]

function getKnowledgeTypeIcon(type: string) {
  switch(type) {
    case 'SharePoint':
      return (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#sp_clip)">
            <path d="M10 12.5C13.3137 12.5 16 9.81371 16 6.5C16 3.18629 13.3137 0.5 10 0.5C6.68629 0.5 4 3.18629 4 6.5C4 9.81371 6.68629 12.5 10 12.5Z" fill="url(#sp_g0)"/>
            <path d="M10 12.5C13.3137 12.5 16 9.81371 16 6.5C16 3.18629 13.3137 0.5 10 0.5C6.68629 0.5 4 3.18629 4 6.5C4 9.81371 6.68629 12.5 10 12.5Z" fill="url(#sp_g1)" fillOpacity="0.2"/>
            <path d="M10 12.5C13.3137 12.5 16 9.81371 16 6.5C16 3.18629 13.3137 0.5 10 0.5C6.68629 0.5 4 3.18629 4 6.5C4 9.81371 6.68629 12.5 10 12.5Z" fill="url(#sp_g2)" fillOpacity="0.31"/>
            <path d="M10 12.5C13.3137 12.5 16 9.81371 16 6.5C16 3.18629 13.3137 0.5 10 0.5C6.68629 0.5 4 3.18629 4 6.5C4 9.81371 6.68629 12.5 10 12.5Z" fill="url(#sp_g3)" fillOpacity="0.7"/>
            <path d="M14.5 15.5C16.9853 15.5 19 13.4853 19 11C19 8.51472 16.9853 6.5 14.5 6.5C12.0147 6.5 10 8.51472 10 11C10 13.4853 12.0147 15.5 14.5 15.5Z" fill="url(#sp_g4)"/>
            <path d="M14.5 15.5C16.9853 15.5 19 13.4853 19 11C19 8.51472 16.9853 6.5 14.5 6.5C12.0147 6.5 10 8.51472 10 11C10 13.4853 12.0147 15.5 14.5 15.5Z" fill="url(#sp_g5)" fillOpacity="0.5"/>
            <path d="M14.5 15.5C16.9853 15.5 19 13.4853 19 11C19 8.51472 16.9853 6.5 14.5 6.5C12.0147 6.5 10 8.51472 10 11C10 13.4853 12.0147 15.5 14.5 15.5Z" fill="url(#sp_g6)" fillOpacity="0.7"/>
            <path d="M10 18.5C12.2091 18.5 14 16.7091 14 14.5C14 12.2909 12.2091 10.5 10 10.5C7.79086 10.5 6 12.2909 6 14.5C6 16.7091 7.79086 18.5 10 18.5Z" fill="url(#sp_g7)"/>
            <path d="M10 18.5C12.2091 18.5 14 16.7091 14 14.5C14 12.2909 12.2091 10.5 10 10.5C7.79086 10.5 6 12.2909 6 14.5C6 16.7091 7.79086 18.5 10 18.5Z" fill="url(#sp_g8)" fillOpacity="0.32"/>
            <rect x="2" y="6.5" width="9" height="9" rx="2" fill="url(#sp_g9)"/>
            <rect x="2" y="6.5" width="9" height="9" rx="2" fill="url(#sp_g10)" fillOpacity="0.6"/>
            <path d="M4.6156 12.5169L5.56388 12.0219C5.6708 12.238 5.81025 12.3972 5.98224 12.4995C6.15656 12.6017 6.34714 12.6529 6.554 12.6529C6.7841 12.6529 6.95958 12.6064 7.08043 12.5134C7.20129 12.4181 7.26172 12.2752 7.26172 12.0846C7.26172 11.9359 7.20362 11.8104 7.08741 11.7081C6.9712 11.6035 6.7655 11.5245 6.47033 11.471C5.90787 11.3687 5.4988 11.1898 5.24314 10.9341C4.9898 10.6785 4.86313 10.36 4.86313 9.97887C4.86313 9.50473 5.03047 9.12588 5.36516 8.84232C5.69985 8.55877 6.14145 8.41699 6.68997 8.41699C7.05952 8.41699 7.38491 8.49253 7.66614 8.6436C7.94737 8.79468 8.17049 9.01083 8.33551 9.29206L7.40815 9.76969C7.30588 9.61164 7.19548 9.49775 7.07695 9.42803C6.95841 9.35598 6.80966 9.31995 6.6307 9.31995C6.41687 9.31995 6.25417 9.36644 6.14261 9.4594C6.03337 9.55237 5.97875 9.67323 5.97875 9.82198C5.97875 9.94981 6.03105 10.0625 6.13564 10.1602C6.24255 10.2554 6.45638 10.3333 6.77712 10.3937C7.31634 10.496 7.71843 10.6819 7.98339 10.9516C8.25068 11.2188 8.38432 11.557 8.38432 11.9661C8.38432 12.4635 8.22511 12.8574 7.90669 13.1479C7.58828 13.4385 7.13389 13.5837 6.54354 13.5837C6.11588 13.5837 5.73006 13.4908 5.38608 13.3048C5.04442 13.1166 4.78759 12.8539 4.6156 12.5169Z" fill="white"/>
          </g>
          <defs>
            <linearGradient id="sp_g0" x1="5.5" y1="2" x2="13.5" y2="12.5" gradientUnits="userSpaceOnUse"><stop stopColor="#00E3DF"/><stop offset="0.41" stopColor="#0097A8"/><stop offset="1" stopColor="#007791"/></linearGradient>
            <radialGradient id="sp_g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(11.84 14.16) rotate(-112.45) scale(9.21 16.56)"><stop offset="0.286" stopColor="#003B5D"/><stop offset="0.612" stopColor="#004A6C" stopOpacity="0.69"/><stop offset="0.968" stopColor="#006F94" stopOpacity="0"/></radialGradient>
            <radialGradient id="sp_g2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12.05 11.51) rotate(-112.06) scale(7.78 13.96)"><stop offset="0.26" stopColor="#002A42"/><stop offset="0.612" stopColor="#004261" stopOpacity="0.69"/><stop offset="0.968" stopColor="#006F94" stopOpacity="0"/></radialGradient>
            <radialGradient id="sp_g3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(13.42 1.14) rotate(124.45) scale(6.51)"><stop stopColor="#78EDFF"/><stop offset="1" stopColor="#2CCFCA" stopOpacity="0"/></radialGradient>
            <linearGradient id="sp_g4" x1="11.125" y1="7.625" x2="17.125" y2="15.5" gradientUnits="userSpaceOnUse"><stop stopColor="#00E0D9"/><stop offset="0.476" stopColor="#009FB8"/><stop offset="0.945" stopColor="#056475"/></linearGradient>
            <radialGradient id="sp_g5" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(11.92 14.75) rotate(-70.8) scale(5.56 10.02)"><stop stopColor="#004A5D"/><stop offset="0.492" stopColor="#00556C" stopOpacity="0.69"/><stop offset="0.968" stopColor="#007A86" stopOpacity="0"/></radialGradient>
            <radialGradient id="sp_g6" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(17.07 6.98) rotate(124.45) scale(4.88)"><stop stopColor="#78EDFF"/><stop offset="1" stopColor="#2CCFCA" stopOpacity="0"/></radialGradient>
            <linearGradient id="sp_g7" x1="7.2" y1="10.9" x2="11.2" y2="18.9" gradientUnits="userSpaceOnUse"><stop offset="0.053" stopColor="#75FFF6"/><stop offset="0.511" stopColor="#00C7D1"/><stop offset="0.96" stopColor="#0096AD"/></linearGradient>
            <linearGradient id="sp_g8" x1="13.98" y1="18.5" x2="11.84" y2="15.5" gradientUnits="userSpaceOnUse"><stop offset="0.26" stopColor="#0E5A5D"/><stop offset="0.536" stopColor="#126C6B" stopOpacity="0.69"/><stop offset="0.968" stopColor="#1C948A" stopOpacity="0"/></linearGradient>
            <radialGradient id="sp_g9" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(2 6.5) rotate(45) scale(12.73)"><stop offset="0.063" stopColor="#00B6BD"/><stop offset="0.89" stopColor="#00495C"/></radialGradient>
            <radialGradient id="sp_g10" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(6.5 11.9) rotate(90) scale(6.3 7.17)"><stop offset="0.567" stopColor="#1E8581" stopOpacity="0"/><stop offset="0.974" stopColor="#1ECBE6"/></radialGradient>
            <clipPath id="sp_clip"><rect width="20" height="20" fill="white"/></clipPath>
          </defs>
        </svg>
      )
    case 'Website':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#707070" strokeWidth="1.3" fill="none" />
          <path d="M8 1.5C8 1.5 5 4.5 5 8s3 6.5 3 6.5M8 1.5c0 0 3 3 3 6.5s-3 6.5-3 6.5M1.5 8h13" stroke="#707070" strokeWidth="1" fill="none" />
        </svg>
      )
    default: // File
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 1.5h6l3 3v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1V2.5a1 1 0 011-1z" stroke="#707070" strokeWidth="1.2" fill="none" />
          <path d="M10 1.5v3h3" stroke="#707070" strokeWidth="1.2" fill="none" />
        </svg>
      )
  }
}

interface KnowledgeSourcesGridProps {
  onKnowledgeSourceClick?: (source: KnowledgeSource) => void
}

function KnowledgeSourcesGrid({ onKnowledgeSourceClick }: KnowledgeSourcesGridProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto" data-hide-scrollbar="true">
        <div className="grid bg-[hsl(var(--surface-secondary))] h-9 items-center " style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.2fr' }}>
          <div className="pl-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Name</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Type</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Total questions</div>
          <div className="px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Response quality</div>
          <div className="pr-6 px-2 text-[11px] leading-4 text-gray-500 border-b border-[rgba(0,0,0,0.06)] h-full flex items-center">Reactions</div>
        </div>
        {KNOWLEDGE_SOURCES.map((src) => (
          <div key={src.id} className="grid bg-white min-h-[44px] hover:bg-[hsl(var(--surface-secondary))] cursor-pointer" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.2fr' }} onClick={() => onKnowledgeSourceClick?.(src)}>
            <div className="pl-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-gray-900">{src.name}</span>
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <span className="inline-flex items-center gap-1 h-5 min-w-[20px] max-w-full px-1.5 bg-gray-100 border border-[rgba(0,0,0,0.09)] rounded-md text-[11px] text-gray-500 overflow-hidden">
                <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center">
                  {getKnowledgeTypeIcon(src.type)}
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {src.type}
                </span>
              </span>
            </div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">{src.totalQuestions.toLocaleString()}</div>
            <div className="px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              <PercentageBadge value={parseInt(src.responseQuality)} label={src.responseQuality} highThreshold={85} midThreshold={70} />
            </div>
            <div className="pr-6 px-2 text-xs text-gray-900 border-b border-[rgba(0,0,0,0.06)] flex items-center h-[44px] overflow-hidden">
              {(src.thumbsUp > 0 || src.thumbsDown > 0) ? (
                <div className="flex items-center gap-4">
                  {src.thumbsUp > 0 && <div className="flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.052 2.29418C10.3913 1.31688 11.6841 0.866611 12.4829 1.70374C12.6455 1.87416 12.8081 2.05832 12.9176 2.22254C13.2379 2.70305 13.3725 3.33584 13.4218 3.9522C13.4721 4.58034 13.438 5.25446 13.3738 5.86473C13.3093 6.47735 13.2129 7.03948 13.1328 7.44766C13.1294 7.46535 13.1259 7.48277 13.1225 7.49989H14.006C15.8777 7.49989 17.2924 9.19503 16.9576 11.0365L16.2737 14.7983C15.8017 17.3942 13.2078 19.0289 10.6622 18.3347L5.06251 16.8075C4.14894 16.5583 3.45455 15.8144 3.26885 14.8859L2.91581 13.1207C2.63809 11.7321 3.69991 10.5623 4.82905 10.116C5.15163 9.9885 5.44337 9.82668 5.66974 9.62586C7.37583 8.11234 7.99442 6.90276 9.05406 4.77684C9.4084 4.06594 9.77205 3.10043 10.052 2.29418ZM12.0165 7.87851L12.0169 7.87696L12.0187 7.86962L12.0262 7.83852C12.0328 7.81068 12.0426 7.76892 12.0549 7.71482C12.0793 7.60658 12.1135 7.44919 12.1515 7.25525C12.2277 6.86655 12.3188 6.33493 12.3793 5.76005C12.4401 5.18282 12.4685 4.57569 12.425 4.03195C12.3806 3.47644 12.2652 3.04673 12.0855 2.77724C12.0264 2.68859 11.9138 2.55593 11.7594 2.3941C11.5605 2.18565 11.1314 2.23417 10.9967 2.62217C10.7141 3.43598 10.3334 4.45183 9.94904 5.22294C8.88216 7.36338 8.19326 8.72396 6.33336 10.3739C5.99304 10.6758 5.58878 10.891 5.19665 11.046C4.31631 11.394 3.75035 12.1944 3.89639 12.9246L4.24943 14.6898C4.36085 15.2469 4.77748 15.6932 5.32562 15.8427L10.9254 17.3699C12.9052 17.9099 14.9227 16.6384 15.2898 14.6194L15.9738 10.8577C16.197 9.62998 15.2538 8.49989 14.006 8.49989H12.5015C12.3476 8.49989 12.2022 8.42895 12.1074 8.3076C12.0127 8.18627 11.9792 8.02785 12.0165 7.87851C12.0165 7.87847 12.0165 7.87855 12.0165 7.87851Z" fill="#424242"/>
                    </svg>
                    <span className="text-[11px] text-gray-600">{src.thumbsUp}</span>
                  </div>}
                  {src.thumbsDown > 0 && <div className="flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.052 17.7057C10.3913 18.683 11.6841 19.1333 12.4829 18.2962C12.6455 18.1257 12.8081 17.9416 12.9176 17.7774C13.2379 17.2968 13.3725 16.6641 13.4218 16.0477C13.4721 15.4195 13.438 14.7454 13.3738 14.1352C13.3093 13.5225 13.2129 12.9604 13.1328 12.5522C13.1294 12.5345 13.1259 12.5171 13.1225 12.5H14.006C15.8777 12.5 17.2924 10.8049 16.9576 8.96334L16.2737 5.20164C15.8017 2.60569 13.2078 0.970952 10.6622 1.66519L5.06251 3.19239C4.14894 3.44154 3.45455 4.18547 3.26885 5.11401L2.91581 6.87918C2.63809 8.2678 3.69991 9.43756 4.82905 9.88388C5.15163 10.0114 5.44337 10.1732 5.66974 10.374C7.37583 11.8875 7.99442 13.0971 9.05406 15.2231C9.4084 15.9339 9.77205 16.8995 10.052 17.7057ZM12.0165 12.1214L12.0169 12.1229L12.0187 12.1303L12.0262 12.1614C12.0328 12.1892 12.0426 12.231 12.0549 12.2851C12.0793 12.3933 12.1135 12.5507 12.1515 12.7446C12.2277 13.1333 12.3188 13.665 12.3793 14.2398C12.4401 14.8171 12.4685 15.4242 12.425 15.9679C12.3806 16.5235 12.2652 16.9532 12.0855 17.2227C12.0264 17.3113 11.9138 17.444 11.7594 17.6058C11.5605 17.8142 11.1314 17.7657 10.9967 17.3777C10.7141 16.5639 10.3334 15.5481 9.94904 14.777C8.88216 12.6365 8.19326 11.2759 6.33336 9.62597C5.99304 9.32406 5.58878 9.1089 5.19665 8.9539C4.31631 8.60592 3.75035 7.80549 3.89639 7.0753L4.24943 5.31013C4.36085 4.753 4.77748 4.30665 5.32562 4.15715L10.9254 2.62995C12.9052 2.08999 14.9227 3.36145 15.2898 5.38053L15.9738 9.14223C16.197 10.3699 15.2538 11.5 14.006 11.5H12.5015C12.3476 11.5 12.2022 11.5709 12.1074 11.6923C12.0127 11.8136 11.9792 11.972 12.0165 12.1214C12.0165 12.1214 12.0165 12.1213 12.0165 12.1214Z" fill="#424242"/>
                    </svg>
                    <span className="text-[11px] text-gray-600">{src.thumbsDown}</span>
                  </div>}
                </div>
              ) : (
                <span className="text-[11px] text-gray-400">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <span className="block text-[10px] text-gray-400 py-2 px-5">AI-generated content may be incorrect</span>
    </div>
  )
}

export { ScoreBadge, EvaluatedItemBadge, EvaluationsGrid, DatasetsGrid, AgentsGrid, KnowledgeSourcesGrid }
export default EvaluationsGrid
