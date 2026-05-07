import React from 'react';
import { CopilotButton } from '../components/ui';

export const ToolsPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-[hsl(var(--surface-secondary))] min-h-0">
      {/* Page header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-0">
        <h1 className="text-2xl font-semibold text-gray-900">Tools</h1>
      </div>

      {/* Empty state — centered */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 pb-24">
        {/* Illustration */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg width="112" height="112" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="tools-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7B5CFA" />
                <stop offset="100%" stopColor="#464FEB" />
              </linearGradient>
              <linearGradient id="tools-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B8AFFE" />
                <stop offset="100%" stopColor="#9B8CF8" />
              </linearGradient>
              <linearGradient id="tools-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C7BCFE" />
                <stop offset="100%" stopColor="#A89CF7" />
              </linearGradient>
            </defs>

            {/* Main block — top-left, larger */}
            <rect x="12" y="28" width="46" height="34" rx="8" fill="url(#tools-grad-1)" />
            {/* Bottom-left block */}
            <rect x="12" y="68" width="20" height="20" rx="5" fill="url(#tools-grad-3)" />
            {/* Bottom-right block */}
            <rect x="38" y="68" width="28" height="20" rx="5" fill="url(#tools-grad-2)" />

            {/* Sparkle — large, top-right of main block */}
            <g transform="translate(62, 18)">
              <path d="M8 0 C8 4.5 11.5 8 16 8 C11.5 8 8 11.5 8 16 C8 11.5 4.5 8 0 8 C4.5 8 8 4.5 8 0Z" fill="#10B981" />
            </g>
            {/* Sparkle — small, far right */}
            <g transform="translate(80, 28)">
              <path d="M4.5 0 C4.5 2.5 6.5 4.5 9 4.5 C6.5 4.5 4.5 6.5 4.5 9 C4.5 6.5 2.5 4.5 0 4.5 C2.5 4.5 4.5 2.5 4.5 0Z" fill="#10B981" opacity="0.7" />
            </g>
            {/* Sparkle dot */}
            <circle cx="82" cy="46" r="2.5" fill="#10B981" opacity="0.5" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Create your first tool</h2>
          <p className="text-sm text-gray-500">Let your agent do more</p>
        </div>

        {/* CTA */}
        <CopilotButton variant="primary" size="md">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New tool
          </span>
        </CopilotButton>
      </div>
    </div>
  );
};

export default ToolsPage;
