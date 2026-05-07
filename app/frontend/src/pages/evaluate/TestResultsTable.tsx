import React, { useState, useMemo } from 'react';
import {
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  ChevronDown20Regular,
  ChevronUp20Regular,
  ChevronRight12Regular,
  ChevronDown12Regular,
  Add16Regular,
  Edit16Regular,
  Delete16Regular,
  MoreHorizontal20Regular,
} from '@fluentui/react-icons';
import { CopilotBadge } from '../../components/ui/CopilotBadge';
import { CopilotButton } from '../../components/ui/CopilotButton';
import { CopilotFilterPill } from '../../components/ui/CopilotFilterPill';
import { CopilotMenu } from '../../components/ui/CopilotMenu';
import { BucketStats, EvalTest } from './types';
import { BUCKET_CONFIG, METHOD_LABELS } from './constants';
import { TestDetailPanel } from './TestDetailPanel';

interface TestResultsTableProps {
  bucketStats: BucketStats[];
  selectedBucket: string | null;
  onUpdateTest?: (bucketName: string, testIdx: number, updates: Partial<{ question: string; expected: string; keywords: string }>) => void;
  onDeleteTest?: (bucketName: string, testIdx: number) => void;
  onAddTest?: (bucketName: string, test: { question: string; expected: string }) => void;
}

type StatusFilter = 'all' | 'pass' | 'fail' | 'untested';

export const TestResultsTable: React.FC<TestResultsTableProps> = ({
  bucketStats, selectedBucket, onUpdateTest, onDeleteTest, onAddTest,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'index' | 'score' | 'status'>('index');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editExpected, setEditExpected] = useState('');
  const [addingToBucket, setAddingToBucket] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const visibleBuckets = selectedBucket
    ? bucketStats.filter(b => b.name === selectedBucket)
    : bucketStats;

  const filterCounts = useMemo(() => {
    const tests = visibleBuckets.flatMap(b => b.tests);
    return {
      all: tests.length,
      pass: tests.filter(t => t.lastResult?.pass === true).length,
      fail: tests.filter(t => t.lastResult?.pass === false).length,
      untested: tests.filter(t => t.lastResult === null).length,
    };
  }, [visibleBuckets]);

  const filterTest = (t: EvalTest): boolean => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pass') return t.lastResult?.pass === true;
    if (statusFilter === 'fail') return t.lastResult?.pass === false;
    if (statusFilter === 'untested') return t.lastResult === null;
    return true;
  };

  const sortTests = (tests: EvalTest[]): Array<EvalTest & { _origIdx: number }> => {
    const indexed = tests.map((t, i) => ({ ...t, _origIdx: i }));
    indexed.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'score') {
        cmp = (a.lastResult?.score ?? -1) - (b.lastResult?.score ?? -1);
      } else if (sortField === 'status') {
        const va = a.lastResult === null ? 0 : a.lastResult.pass ? 2 : 1;
        const vb = b.lastResult === null ? 0 : b.lastResult.pass ? 2 : 1;
        cmp = va - vb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return indexed;
  };

  const toggleSort = (field: 'score' | 'status') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleBucketCollapse = (name: string) => {
    setCollapsedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const startEdit = (key: string, test: EvalTest) => {
    setEditingKey(key);
    setEditQuestion(test.question);
    setEditExpected(test.expected);
  };

  const commitEdit = (bucketName: string, origIdx: number) => {
    onUpdateTest?.(bucketName, origIdx, { question: editQuestion, expected: editExpected });
    setEditingKey(null);
  };

  const startAdd = (bucketName: string) => {
    setAddingToBucket(bucketName);
    setNewQuestion('');
    setNewExpected('');
  };

  const commitAdd = (bucketName: string) => {
    if (newQuestion.trim()) {
      onAddTest?.(bucketName, { question: newQuestion, expected: newExpected });
    }
    setAddingToBucket(null);
  };

  const totalVisible = visibleBuckets.reduce((sum, b) => sum + b.tests.filter(filterTest).length, 0);

  const GRID = 'grid-cols-[32px_minmax(0,2fr)_minmax(0,1.5fr)_56px_68px_36px]';

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <CopilotFilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All" count={filterCounts.all} size="sm" />
        <CopilotFilterPill active={statusFilter === 'pass'} onClick={() => setStatusFilter('pass')} label="Pass" count={filterCounts.pass} size="sm" />
        <CopilotFilterPill active={statusFilter === 'fail'} onClick={() => setStatusFilter('fail')} label="Fail" count={filterCounts.fail} size="sm" />
        {filterCounts.untested > 0 && (
          <CopilotFilterPill active={statusFilter === 'untested'} onClick={() => setStatusFilter('untested')} label="Not run" count={filterCounts.untested} size="sm" />
        )}
      </div>

      {totalVisible === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No tests match this filter.</div>
      ) : (
        <div className="space-y-6">
          {visibleBuckets.map(bucket => {
            const filteredTests = sortTests(bucket.tests.filter(filterTest));
            if (filteredTests.length === 0) return null;
            const isCollapsed = collapsedBuckets.has(bucket.name);
            const bucketLabel = BUCKET_CONFIG[bucket.name]?.label ?? bucket.name;

            return (
              <div key={bucket.name}>
                {/* Bucket header */}
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => toggleBucketCollapse(bucket.name)} className="flex items-center gap-2 cursor-pointer">
                    {isCollapsed ? <ChevronRight12Regular className="w-3 h-3 text-gray-400" /> : <ChevronDown12Regular className="w-3 h-3 text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-800">{bucketLabel}</span>
                    <span className="text-xs text-gray-400">
                      {bucket.testedCount > 0 ? `${bucket.passCount}/${bucket.testedCount} pass, ${bucket.passRate}%` : `${bucket.totalTests} tests`}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <CopilotButton variant="ghost" size="sm" icon={<Add16Regular />} onClick={() => startAdd(bucket.name)}>
                      Add test
                    </CopilotButton>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className={`grid ${GRID} bg-gray-50/80 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase tracking-wide`}>
                      <div className="px-2.5 py-2">#</div>
                      <div className="px-2.5 py-2">Question</div>
                      <div className="px-2.5 py-2">Expected</div>
                      <div className="px-2.5 py-2 cursor-pointer select-none" onClick={() => toggleSort('score')}>
                        Score {sortField === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                      <div className="px-2.5 py-2 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                        Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                      <div className="px-2.5 py-2" />
                    </div>

                    {/* Rows */}
                    {filteredTests.map((test, displayIdx) => {
                      const testKey = `${bucket.name}-${test._origIdx}`;
                      const isExpanded = expandedKey === testKey;
                      const isEditing = editingKey === testKey;
                      const r = test.lastResult;

                      return (
                        <React.Fragment key={testKey}>
                          {isEditing ? (
                            /* Inline edit row */
                            <div className="border-b border-gray-100 px-3 py-3 bg-blue-50/30">
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                  <label className="text-[10px] uppercase text-gray-500 font-medium mb-1 block">Question</label>
                                  <textarea
                                    className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                    rows={2}
                                    value={editQuestion}
                                    onChange={e => setEditQuestion(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase text-gray-500 font-medium mb-1 block">Expected</label>
                                  <textarea
                                    className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                    rows={2}
                                    value={editExpected}
                                    onChange={e => setEditExpected(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 justify-end">
                                <CopilotButton variant="ghost" size="sm" onClick={() => setEditingKey(null)}>Cancel</CopilotButton>
                                <CopilotButton variant="primary" size="sm" onClick={() => commitEdit(bucket.name, test._origIdx)}>Save</CopilotButton>
                              </div>
                            </div>
                          ) : (
                            /* Normal row */
                            <div
                              className={`grid ${GRID} items-center border-b border-gray-100 last:border-b-0 text-sm group transition-colors ${
                                r ? 'cursor-pointer hover:bg-gray-50/60' : 'hover:bg-gray-50/30'
                              } ${isExpanded ? 'bg-gray-50/40' : ''}`}
                              onClick={() => r && setExpandedKey(isExpanded ? null : testKey)}
                            >
                              <div className="px-2.5 py-2.5 text-xs text-gray-400 tabular-nums">{displayIdx + 1}</div>
                              <div className="px-2.5 py-2.5 text-gray-800 text-[13px] leading-snug min-w-0">
                                <span className="line-clamp-2 whitespace-normal break-words">
                                  {test.question || <span className="italic text-gray-400">(empty input)</span>}
                                </span>
                              </div>
                              <div className="px-2.5 py-2.5 text-gray-500 text-xs leading-snug min-w-0">
                                <span className="line-clamp-2 whitespace-normal break-words">{test.expected}</span>
                              </div>
                              <div className="px-2.5 py-2.5 tabular-nums text-gray-800 text-[13px]">
                                {r ? `${r.score}%` : '—'}
                              </div>
                              <div className="px-2.5 py-2.5">
                                {r === null ? (
                                  <CopilotBadge appearance="tint" color="subtle" size="small">Not run</CopilotBadge>
                                ) : r.pass ? (
                                  <span className="flex items-center gap-1">
                                    <CheckmarkCircle16Filled className="w-3.5 h-3.5 text-[hsl(var(--status-success))]" />
                                    <span className="text-[11px] text-[hsl(var(--status-success))]">Pass</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <DismissCircle16Filled className="w-3.5 h-3.5 text-[hsl(var(--status-error))]" />
                                    <span className="text-[11px] text-[hsl(var(--status-error))]">Fail</span>
                                  </span>
                                )}
                              </div>
                              <div className="px-2.5 py-2.5 flex items-center justify-center">
                                {r ? (
                                  isExpanded
                                    ? <ChevronUp20Regular className="w-4 h-4 text-gray-400" />
                                    : <ChevronDown20Regular className="w-4 h-4 text-gray-400" />
                                ) : (
                                  /* Actions for unrun tests */
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setMenuPos({ top: rect.bottom + 4, left: rect.left - 100 });
                                      setMenuKey(testKey);
                                    }}
                                  >
                                    <MoreHorizontal20Regular className="w-4 h-4 text-gray-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Expanded detail */}
                          {isExpanded && r && (
                            <div className="px-4 py-3 border-b border-gray-100 bg-white">
                              <div className="flex items-center justify-end gap-1 mb-2">
                                <CopilotButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<Edit16Regular />}
                                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); startEdit(testKey, test); setExpandedKey(null); }}
                                >
                                  Edit
                                </CopilotButton>
                                <CopilotButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<Delete16Regular />}
                                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDeleteTest?.(bucket.name, test._origIdx); setExpandedKey(null); }}
                                  className="text-[hsl(var(--status-error))] hover:text-[hsl(var(--status-error))]"
                                >
                                  Delete
                                </CopilotButton>
                              </div>
                              <TestDetailPanel test={test} result={r} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Add test row */}
                    {addingToBucket === bucket.name && (
                      <div className="border-t border-gray-200 px-3 py-3 bg-green-50/20">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-medium mb-1 block">Question</label>
                            <textarea
                              className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                              rows={2}
                              value={newQuestion}
                              onChange={e => setNewQuestion(e.target.value)}
                              placeholder="What should the agent be asked?"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-medium mb-1 block">Expected</label>
                            <textarea
                              className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                              rows={2}
                              value={newExpected}
                              onChange={e => setNewExpected(e.target.value)}
                              placeholder="What should the response contain?"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <CopilotButton variant="ghost" size="sm" onClick={() => setAddingToBucket(null)}>Cancel</CopilotButton>
                          <CopilotButton variant="primary" size="sm" onClick={() => commitAdd(bucket.name)} disabled={!newQuestion.trim()}>Add test</CopilotButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Context menu for unrun tests */}
      {menuKey && menuPos && (
        <CopilotMenu
          items={[
            { label: 'Edit', icon: <Edit16Regular className="w-4 h-4" />, onClick: () => {
              const [bName, idxStr] = menuKey.split('-');
              const bucket = bucketStats.find(b => b.name === bName) ?? visibleBuckets.find(b => menuKey.startsWith(b.name));
              if (bucket) {
                const origIdx = parseInt(idxStr);
                const test = bucket.tests[origIdx];
                if (test) startEdit(menuKey, test);
              }
            }},
            { label: 'Delete', icon: <Delete16Regular className="w-4 h-4" />, destructive: true, onClick: () => {
              const parts = menuKey.split('-');
              const origIdx = parseInt(parts[parts.length - 1]);
              const bName = parts.slice(0, -1).join('-');
              onDeleteTest?.(bName, origIdx);
            }},
          ]}
          position={menuPos}
          onClose={() => { setMenuKey(null); setMenuPos(null); }}
        />
      )}
    </div>
  );
};
