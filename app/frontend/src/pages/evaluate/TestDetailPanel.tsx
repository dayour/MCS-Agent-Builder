import React from 'react';
import { CopilotBadge } from '../../components/ui/CopilotBadge';
import { EvalTest, EvalTestResult } from './types';
import { METHOD_LABELS } from './constants';

interface TestDetailPanelProps {
  test: EvalTest;
  result: EvalTestResult;
}

export const TestDetailPanel: React.FC<TestDetailPanelProps> = ({ test, result }) => {
  return (
    <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-5 space-y-5 animate-fadeIn">
      {/* Method Scores */}
      {result.methodResults.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
            Method Scores
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {result.methodResults.map((mr, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-3 rounded-md bg-white border border-gray-100"
              >
                <span className="text-sm text-gray-700">
                  {METHOD_LABELS[mr.method] ?? mr.method}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums text-gray-900">
                    {mr.score}%
                  </span>
                  <CopilotBadge
                    appearance="tint"
                    color={mr.pass ? 'success' : 'danger'}
                    size="small"
                  >
                    {mr.pass ? 'Pass' : 'Fail'}
                  </CopilotBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Comparison */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
          Response Comparison
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Expected</div>
            <div className="text-sm text-gray-800 bg-[hsl(var(--status-success) / 0.15)]/40 border border-[hsl(var(--status-success))]/10 rounded-md px-3 py-2 whitespace-pre-wrap break-words">
              {test.expected}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Actual</div>
            <div className={`text-sm text-gray-800 rounded-md px-3 py-2 whitespace-pre-wrap break-words border ${
              result.pass
                ? 'bg-[hsl(var(--status-success) / 0.15)]/40 border-[hsl(var(--status-success))]/10'
                : 'bg-[hsl(var(--status-error) / 0.15)]/40 border-[hsl(var(--status-error))]/10'
            }`}>
              {result.actual || '(no response)'}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-turn Conversation */}
      {result.turnResults && result.turnResults.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
            Conversation Turns
          </h4>
          <div className="space-y-2">
            {result.turnResults.map((turn, i) => (
              <div
                key={i}
                className={`border-l-2 pl-3 py-2 ${
                  turn.pass ? 'border-[hsl(var(--status-success))]' : 'border-[hsl(var(--status-error))]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">Turn {turn.turnIndex + 1}</span>
                  {turn.critical && (
                    <CopilotBadge appearance="tint" color="important" size="small">Critical</CopilotBadge>
                  )}
                  <CopilotBadge appearance="tint" color={turn.pass ? 'success' : 'danger'} size="small">
                    {turn.pass ? 'Pass' : 'Fail'} {turn.score}%
                  </CopilotBadge>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Q:</span> {test.turns?.[i]?.question ?? '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium">A:</span> {turn.actual || '(no response)'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Invocations */}
      {result.toolInvocations && result.toolInvocations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
            Tool Invocations
          </h4>
          <div className="font-mono text-xs bg-white rounded-md border border-gray-100 p-3 space-y-1">
            {result.toolInvocations.map((tool, i) => (
              <div key={i} className="text-gray-700 flex items-center gap-1.5">
                <span className="text-gray-400">&#x2022;</span>
                {tool}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
