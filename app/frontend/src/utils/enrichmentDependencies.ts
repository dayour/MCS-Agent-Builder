/**
 * Input → enrichment-generator dependency map.
 *
 * Used by the refresh flow to answer "which spec edits invalidate which
 * generated output?" — per-section stale badges and the refresh CTA both
 * read from this.
 *
 * Source of truth: the four generators under app/lib/generators/. Whenever
 * those change, update this map and the accompanying unit-style notes below.
 *
 * Verified against:
 *   - app/lib/generators/instructions.js (buildUserMessage reads agent.*, capabilities, boundaries)
 *   - app/lib/generators/evals.js        (buildStubSets reads agent.name, capabilities)
 *   - app/lib/generators/scoring.js      (reads capabilities, integrations, knowledge, architecture)
 *   - app/lib/generators/research.js     (classifies integrations — Work IQ keyword detection)
 */

export type EnrichmentGenerator = 'scoring' | 'instructions' | 'evals' | 'research';

/** Which top-level spec fields feed each generator's output. */
export const GENERATOR_INPUTS: Record<EnrichmentGenerator, readonly string[]> = {
  instructions: ['agent', 'capabilities', 'boundaries'],
  evals:        ['agent', 'capabilities'],
  scoring:      ['capabilities', 'integrations', 'knowledge'],
  research:     ['integrations'],
};

/**
 * Inverse: for each spec field, which generator outputs does an edit
 * invalidate? Derived from GENERATOR_INPUTS — keep in sync.
 *
 * Fields NOT present here (topics, openQuestions, decisions, documents) are
 * process/authoring artifacts and don't feed any enrichment output.
 */
export const FIELD_TO_GENERATORS: Record<string, readonly EnrichmentGenerator[]> = (() => {
  const map: Record<string, EnrichmentGenerator[]> = {};
  (Object.entries(GENERATOR_INPUTS) as [EnrichmentGenerator, readonly string[]][])
    .forEach(([gen, fields]) => {
      for (const f of fields) {
        if (!map[f]) map[f] = [];
        map[f].push(gen);
      }
    });
  return map;
})();

/** Spec fields that feed at least one generator. */
export const ENRICHMENT_INPUT_FIELDS: readonly string[] = Object.keys(FIELD_TO_GENERATORS);
