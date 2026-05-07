import React, { useState, useCallback } from 'react';
import { Add20Regular, Play20Filled, ArrowDownload20Regular } from '@fluentui/react-icons';
import { CopilotButton } from '../../components/ui/CopilotButton';
import { useAgent } from '../../context/AgentContext';
import { useEvalData } from './useEvalData';
import { VerdictBanner } from './VerdictBanner';
import { BucketCard } from './BucketCard';
import { TestResultsTable } from './TestResultsTable';
import { CreateEvalDialog } from './CreateEvalDialog';

interface EvalDashboardProps {
  isNarrowPreview: boolean;
}

export const EvalDashboard: React.FC<EvalDashboardProps> = ({ isNarrowPreview }) => {
  const { updateAgentConfig, agentConfig } = useAgent();
  const { bucketStats, hasResults, lastVerdict, lastVerdictAt, overallStats } = useEvalData();

  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateEvalSet = (evalSet: {
    name: string;
    description: string;
    passThreshold: number;
    methods: Array<{ type: string; score?: number; mode?: string }>;
    tests: [];
  }) => {
    const existing = (agentConfig as any).evalSets ?? [];
    updateAgentConfig({ evalSets: [...existing, evalSet] } as any);
  };

  const handleExportCSV = useCallback(() => {
    const rows: string[] = ['Bucket,Question,Expected,Actual,Score,Status,Methods'];
    for (const bucket of bucketStats) {
      for (const test of bucket.tests) {
        const r = test.lastResult;
        const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        const methods = r ? r.methodResults.map(m => m.method).join('; ') : bucket.methods.map(m => m.type).join('; ');
        rows.push([
          esc(bucket.name),
          esc(test.question),
          esc(test.expected),
          esc(r?.actual ?? ''),
          r ? String(r.score) : '',
          r === null ? 'not run' : r.pass ? 'pass' : 'fail',
          esc(methods),
        ].join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eval-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bucketStats]);

  const handleUpdateTest = useCallback((bucketName: string, testIdx: number, updates: Partial<{ question: string; expected: string; keywords: string }>) => {
    const existing: any[] = (agentConfig as any).evalSets ?? [];
    const updated = existing.map(set => {
      if (set.name !== bucketName) return set;
      const tests = [...set.tests];
      tests[testIdx] = { ...tests[testIdx], ...updates };
      return { ...set, tests };
    });
    updateAgentConfig({ evalSets: updated } as any);
  }, [agentConfig, updateAgentConfig]);

  const handleDeleteTest = useCallback((bucketName: string, testIdx: number) => {
    const existing: any[] = (agentConfig as any).evalSets ?? [];
    const updated = existing.map(set => {
      if (set.name !== bucketName) return set;
      const tests = set.tests.filter((_: any, i: number) => i !== testIdx);
      return { ...set, tests };
    });
    updateAgentConfig({ evalSets: updated } as any);
  }, [agentConfig, updateAgentConfig]);

  const handleAddTest = useCallback((bucketName: string, test: { question: string; expected: string }) => {
    const existing: any[] = (agentConfig as any).evalSets ?? [];
    const updated = existing.map(set => {
      if (set.name !== bucketName) return set;
      return { ...set, tests: [...set.tests, { ...test, lastResult: null, source: 'user-added' }] };
    });
    updateAgentConfig({ evalSets: updated } as any);
  }, [agentConfig, updateAgentConfig]);

  return (
    <div className={`h-full flex flex-col ${isNarrowPreview ? 'bg-[hsl(var(--surface-secondary))]' : 'bg-[hsl(var(--background))]'}`}>
      {/* Header */}
      <div className={`flex-shrink-0 ${isNarrowPreview ? 'px-4 pt-4' : 'px-8 pt-8'}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Evaluate</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Test your agent across safety, quality, and edge-case scenarios
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<ArrowDownload20Regular />}
              onClick={handleExportCSV}
            >
              Export CSV
            </CopilotButton>
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<Add20Regular />}
              onClick={() => setShowCreateDialog(true)}
            >
              Add eval set
            </CopilotButton>
            <CopilotButton variant="primary" size="sm" icon={<Play20Filled />}>
              Run all tests
            </CopilotButton>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${isNarrowPreview ? 'px-4 pb-8' : 'max-w-[1024px] mx-auto px-8 pb-8'}`}>
          {/* Verdict Banner */}
          {hasResults && lastVerdict && (
            <VerdictBanner verdict={lastVerdict} lastVerdictAt={lastVerdictAt} />
          )}

          {/* KPI row */}
          {hasResults && (
            <div className={`grid ${isNarrowPreview ? 'grid-cols-2' : 'grid-cols-4'} gap-4 mb-6`}>
              <KPICard label="Overall Pass Rate" value={`${overallStats.overallRate}%`} large />
              <KPICard label="Tests Run" value={`${overallStats.totalTested}/${overallStats.totalTests}`} />
              <KPICard label="Passing" value={String(overallStats.totalPass)} color="success" />
              <KPICard label="Failing" value={String(overallStats.totalFail)} color={overallStats.totalFail > 0 ? 'danger' : undefined} />
            </div>
          )}

          {/* Bucket Cards */}
          <div className={`grid ${isNarrowPreview ? 'grid-cols-1' : 'grid-cols-3'} gap-4 mb-8`}>
            {bucketStats.map(bucket => (
              <BucketCard
                key={bucket.name}
                stats={bucket}
                isSelected={selectedBucket === bucket.name}
                onClick={() => setSelectedBucket(
                  selectedBucket === bucket.name ? null : bucket.name
                )}
              />
            ))}
          </div>

          {/* Test Results */}
          <TestResultsTable
            bucketStats={bucketStats}
            selectedBucket={selectedBucket}
            onUpdateTest={handleUpdateTest}
            onDeleteTest={handleDeleteTest}
            onAddTest={handleAddTest}
          />
        </div>
      </div>

      {/* Create Dialog */}
      <CreateEvalDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateEvalSet}
        existingBuckets={bucketStats.map(b => b.name)}
      />
    </div>
  );
};

// Inline KPI card component
const KPICard: React.FC<{
  label: string;
  value: string;
  color?: 'success' | 'danger';
  large?: boolean;
}> = ({ label, value, color, large }) => {
  const valueColor = color === 'success'
    ? 'text-[hsl(var(--status-success))]'
    : color === 'danger'
      ? 'text-[hsl(var(--status-error))]'
      : 'text-[hsl(var(--text-primary))]';

  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`${large ? 'text-2xl' : 'text-xl'} font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
};
