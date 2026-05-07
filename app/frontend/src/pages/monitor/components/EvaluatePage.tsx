import React from 'react'
import { ChevronLeft24Regular } from '@fluentui/react-icons'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import type { Evaluation } from '../types'

interface EvaluatePageProps {
  evaluation: Evaluation
  onBack: () => void
}

export default function EvaluatePage({ evaluation, onBack }: EvaluatePageProps) {
  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      <div className="px-4 pt-2.5 pb-2.5 box-border">
        <div className="max-w-full mx-auto">
        <div className="mb-2.5">
          <div className="flex items-center gap-2">
            <CopilotButton variant="icon-subtle" size="xs" onClick={onBack} aria-label="Back">
              <ChevronLeft24Regular />
            </CopilotButton>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Evaluate</h3>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
