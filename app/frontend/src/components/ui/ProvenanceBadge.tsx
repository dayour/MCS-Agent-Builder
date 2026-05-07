/**
 * ProvenanceBadge — tiny chip showing where a spec's data came from.
 *
 * Shown on SpecPage header as a coarse-grained lineage summary. Not a
 * field-level claim. When a spec carries multiple origins, the caller renders
 * one badge per source (via ProvenanceSummary).
 *
 * The source taxonomy must stay in sync with app/lib/provenance.js SOURCES.
 */

import React from 'react';
import { CopilotBadge } from './CopilotBadge';

type ProvenanceSource =
  | 'user'
  | 'wizard'
  | 'chat'
  | 'inference'
  | 'research'
  | 'enrichment'
  | 'upload';

const LABEL: Record<ProvenanceSource, string> = {
  user:       'Your edits',
  wizard:     'Wizard',
  chat:       'Chat',
  inference:  'AI inferred',
  research:   'Deep Research',
  enrichment: 'Auto-filled',
  upload:     'From documents',
};

// Palette maps cleanly onto CopilotBadge semantic colors.
const COLOR: Record<ProvenanceSource, 'brand' | 'success' | 'warning' | 'neutral' | 'informative'> = {
  user:       'success',
  wizard:     'brand',
  chat:       'brand',
  inference:  'informative',
  research:   'brand',
  enrichment: 'informative',
  upload:     'neutral',
};

export const ProvenanceBadge: React.FC<{ source: ProvenanceSource }> = ({ source }) => {
  const label = LABEL[source];
  const color = COLOR[source];
  if (!label) return null;
  return (
    <CopilotBadge appearance="tint" color={color} size="small">
      {label}
    </CopilotBadge>
  );
};

/**
 * Compute unique top-level sources present in a spec's _provenance map.
 * Pure helper — no React.
 */
export function uniqueProvenanceSources(
  provenance: Record<string, { lastSetBy?: string }> | undefined | null,
): ProvenanceSource[] {
  if (!provenance) return [];
  const known: ProvenanceSource[] = ['user', 'wizard', 'chat', 'inference', 'research', 'enrichment', 'upload'];
  const seen = new Set<ProvenanceSource>();
  for (const record of Object.values(provenance)) {
    const src = record?.lastSetBy;
    if (src && (known as string[]).includes(src)) seen.add(src as ProvenanceSource);
  }
  // Stable deterministic order so re-renders don't shuffle chips.
  return known.filter((s) => seen.has(s));
}

/**
 * Render a row of chips for every origin present in the spec's provenance map.
 * Shows nothing when provenance is absent — honest: we don't pretend we know.
 */
export const ProvenanceSummary: React.FC<{
  provenance?: Record<string, { lastSetBy?: string }> | null;
}> = ({ provenance }) => {
  const sources = uniqueProvenanceSources(provenance);
  if (sources.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sources.map((s) => (
        <ProvenanceBadge key={s} source={s} />
      ))}
    </div>
  );
};
