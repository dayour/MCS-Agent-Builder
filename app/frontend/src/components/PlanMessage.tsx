import React from 'react';
import { Plan } from '../types/plan';
import { CopilotButton, AgentIcon } from './ui';

interface PlanMessageProps {
  plan: Plan;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
  agentType?: 'agent' | 'workflow';
  agentData?: any;
}

export const PlanMessage: React.FC<PlanMessageProps> = ({
  plan,
  onApprove,
  onReject,
  agentType = 'agent',
  agentData
}) => {
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  const handleReject = () => {
    if (showFeedback && feedback.trim()) {
      onReject(feedback);
      setShowFeedback(false);
      setFeedback('');
    } else {
      setShowFeedback(true);
    }
  };

  const badgeLabel = agentType === 'workflow'
    ? 'Workflow'
    : agentData?.audience === 'customers'
      ? 'Agent for customers'
      : agentData?.audience === 'employees'
        ? 'Agent for employees'
        : 'Agent';

  return (
    <div className="border border-[hsl(var(--stroke-default))] overflow-hidden max-w-[780px] mx-auto animate-slide-up-fade bg-white" style={{ borderRadius: 'var(--radius-3xl)' }}>

      {/* Section 1: Agent header */}
      <div className="px-5 py-4">
        <div className="flex gap-4 items-center">
          {agentData && (
            <AgentIcon agent={agentData} size={64} className="mt-1" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-base truncate">
                {agentData?.name || plan.title}
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full whitespace-nowrap flex-shrink-0">
                {badgeLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
              {agentData?.description || plan.summary}
            </p>
            {agentType !== 'workflow' && agentData?.channel && (
              <p className="text-caption-1-strong text-gray-700 mt-1">
                {agentData.channel}
              </p>
            )}
            {agentType === 'workflow' && agentData?.recurrence && (
              <p className="text-caption-1-strong text-gray-700 mt-1">
                Runs {agentData.recurrence}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[hsl(var(--stroke-default))]" />

      {/* Section 2: Plan steps */}
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">Here's what it'll do</p>
        <div className="space-y-0">
          {plan.steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center gap-3 py-0.5"
            >
              {agentType === 'workflow' ? (
                <div className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-gray-500">{index + 1}</span>
                </div>
              ) : (
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  <div className="w-[5px] h-[5px] rounded-full bg-gray-400" />
                </div>
              )}
              <span className="text-sm text-gray-600">{step.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2b: Knowledge sources (shown when agent has confirmed knowledge sources) */}
      {agentData?.knowledgeSources && agentData.knowledgeSources.length > 0 && (
        <>
          <div className="border-t border-[hsl(var(--stroke-default))]" />
          <div className="px-5 py-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Knowledge it has access to</p>
            <div className="space-y-0">
              {agentData.knowledgeSources.map((source: string, index: number) => (
                <div key={index} className="flex items-center gap-3 py-0.5">
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <div className="w-[5px] h-[5px] rounded-full bg-gray-400" />
                  </div>
                  <span className="text-sm text-gray-600">{source}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-[hsl(var(--stroke-default))]" />

      {/* Section 3: Expected outcome */}
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Expected outcome</p>
        <p className="text-sm text-gray-600">{plan.expectedOutcome}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-[hsl(var(--stroke-default))]" />

      {/* Section 4: Action buttons */}
      <div className="px-5 py-3">
        {showFeedback ? (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What would you like me to change about this plan?"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <CopilotButton
                variant="primary"
                size="md"
                onClick={handleReject}
                disabled={!feedback.trim()}
              >
                Continue
              </CopilotButton>
              <CopilotButton
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowFeedback(false);
                  setFeedback('');
                }}
              >
                Cancel
              </CopilotButton>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <CopilotButton variant="primary" size="md" onClick={onApprove}>
              Create
            </CopilotButton>
            <CopilotButton variant="secondary" size="md" onClick={handleReject}>
              Make changes
            </CopilotButton>
          </div>
        )}
      </div>
    </div>
  );
};
