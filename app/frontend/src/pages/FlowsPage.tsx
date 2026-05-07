import React, { useState } from 'react';
import { CopilotButton, CopilotInput } from '../components/ui';
import { Send20Regular } from '@fluentui/react-icons';

export const FlowsPage: React.FC = () => {
  const [query, setQuery] = useState('');

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--surface-secondary))] min-h-0">
      {/* Page header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-0">
        <h1 className="text-2xl font-semibold text-gray-900">Agent flows</h1>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col px-8 pt-6 gap-5">
        {/* AI input bar */}
        <div className="relative w-full max-w-2xl">
          <CopilotInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like your flow to do"
            size="lg"
            contentBefore={<img src="./copilot-studio-logo.svg" alt="" className="w-5 h-5 flex-shrink-0" />}
            contentAfter={
              <CopilotButton variant="primary" size="sm" icon={<Send20Regular />} />
            }
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <CopilotButton variant="secondary" size="sm">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              New agent flow
            </span>
          </CopilotButton>
          <CopilotButton variant="secondary" size="sm">
            Open workflow designer
          </CopilotButton>
        </div>

        {/* Empty state card */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded-2xl bg-white flex flex-col items-center justify-center gap-4 py-16 mb-8">
          {/* Flow icon illustration */}
          <div className="flex items-center justify-center">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="flows-grad-circle" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="flows-grad-diamond" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="flows-grad-rect1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93C5FD" />
                  <stop offset="100%" stopColor="#60A5FA" />
                </linearGradient>
                <linearGradient id="flows-grad-rect2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6EE7B7" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>
              {/* Top circle node */}
              <circle cx="36" cy="10" r="8" fill="url(#flows-grad-circle)" />
              {/* Connector line top → diamond */}
              <line x1="36" y1="18" x2="36" y2="30" stroke="#D1D5DB" strokeWidth="2" />
              {/* Diamond decision node */}
              <rect x="26" y="30" width="20" height="20" rx="3" transform="rotate(45 36 40)" fill="url(#flows-grad-diamond)" />
              {/* Connector line left branch */}
              <line x1="27" y1="46" x2="18" y2="55" stroke="#D1D5DB" strokeWidth="2" />
              {/* Connector line right branch */}
              <line x1="45" y1="46" x2="54" y2="55" stroke="#D1D5DB" strokeWidth="2" />
              {/* Left rect node */}
              <rect x="9" y="55" width="18" height="12" rx="3" fill="url(#flows-grad-rect1)" />
              {/* Right rect node */}
              <rect x="45" y="55" width="18" height="12" rx="3" fill="url(#flows-grad-rect2)" />
            </svg>
          </div>

          <div className="flex flex-col items-center gap-2 text-center max-w-sm">
            <h2 className="text-lg font-semibold text-gray-900">Start building agent flows for fast, predictable automations</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Agent flows are automations that follow the same instructions with every run. You can build one by describing it to AI or starting with a blank designer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowsPage;
