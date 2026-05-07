import React, { useState, useMemo, useEffect } from 'react';
import { CopilotInput } from '../components/ui/CopilotInput';
import { CopilotFilterPill } from '../components/ui/CopilotFilterPill';
import { CopilotBadge } from '../components/ui/CopilotBadge';
import {
  Search20Regular,
  Box20Regular,
  DocumentOnePageSparkle20Regular,
  ArrowDownload20Regular,
  Briefcase20Regular,
} from '@fluentui/react-icons';

/* ─── Types ─── */

interface SolutionItem {
  id: string;
  name: string;
  files: number;
  agents: number;
  tags: Record<string, string>;
  hasPresentation: boolean;
  hasSolution: boolean;
}

type SolutionFilter = 'all' | 'deployable' | 'reference';

/* ─── Component ─── */

export const DiscoverPage: React.FC = () => {
  const [solutions, setSolutions] = useState<SolutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SolutionFilter>('all');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/solutions')
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(data => { if (!cancelled) setSolutions(data.solutions || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let results = [...solutions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(s => s.name.toLowerCase().includes(q));
    }

    if (activeFilter === 'deployable') {
      results = results.filter(s => s.hasSolution);
    } else if (activeFilter === 'reference') {
      results = results.filter(s => !s.hasSolution);
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [solutions, searchQuery, activeFilter]);

  const counts = useMemo(() => ({
    all: solutions.length,
    deployable: solutions.filter(s => s.hasSolution).length,
    reference: solutions.filter(s => !s.hasSolution).length,
  }), [solutions]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="py-6">
        <h1 className="text-2xl font-semibold text-[hsl(var(--text-primary))]">Solution Library</h1>
        <p className="text-sm text-[hsl(var(--text-subtle))] mt-1">
          {loading ? 'Loading solutions...' : `${solutions.length} solutions from SharePoint`}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 py-4">
        <CopilotFilterPill active={activeFilter === 'all'} label={`All (${counts.all})`} onClick={() => setActiveFilter('all')} />
        <CopilotFilterPill active={activeFilter === 'deployable'} label={`Deployable (${counts.deployable})`} onClick={() => setActiveFilter('deployable')} icon={<ArrowDownload20Regular />} />
        <CopilotFilterPill active={activeFilter === 'reference'} label={`Reference (${counts.reference})`} onClick={() => setActiveFilter('reference')} icon={<DocumentOnePageSparkle20Regular />} />

        <div className="flex-1" />

        <div className="w-64">
          <CopilotInput
            placeholder="Search solutions..."
            icon={<Search20Regular />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Briefcase20Regular className="w-10 h-10 text-[hsl(var(--text-disabled))] mb-3 animate-pulse" />
            <p className="text-[hsl(var(--text-subtle))]">Loading solutions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search20Regular className="w-10 h-10 text-[hsl(var(--text-disabled))] mb-3" />
            <p className="font-medium text-[hsl(var(--text-subtle))]">No solutions found</p>
            <p className="text-sm text-[hsl(var(--text-disabled))] mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(solution => (
              <div
                key={solution.id}
                className="group border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary)/0.4)] hover:shadow-sm transition-all cursor-default"
              >
                {/* Icon + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center flex-shrink-0">
                    <Box20Regular className="w-5 h-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-[hsl(var(--text-primary))] leading-tight truncate">{solution.name}</h3>
                    <p className="text-xs text-[hsl(var(--text-subtle))] mt-0.5">
                      {solution.files} file{solution.files !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {solution.hasSolution && (
                    <CopilotBadge appearance="tint" color="success" size="small">
                      <ArrowDownload20Regular className="w-3 h-3 mr-0.5" />
                      Deployable
                    </CopilotBadge>
                  )}
                  {solution.hasPresentation && (
                    <CopilotBadge appearance="tint" color="informative" size="small">
                      <DocumentOnePageSparkle20Regular className="w-3 h-3 mr-0.5" />
                      Deck
                    </CopilotBadge>
                  )}
                  {!solution.hasSolution && !solution.hasPresentation && (
                    <CopilotBadge appearance="tint" color="subtle" size="small">Reference</CopilotBadge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
