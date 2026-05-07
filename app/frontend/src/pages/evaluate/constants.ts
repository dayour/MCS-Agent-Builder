export const VERDICT_CONFIG = {
  SHIP: {
    label: 'Ship',
    color: 'success' as const,
    bg: 'bg-[hsl(var(--status-success)/0.12)]',
    text: 'text-[hsl(var(--status-success))]',
    border: 'border-[hsl(var(--status-success)/0.3)]',
    icon: 'checkmark',
  },
  'SHIP WITH KNOWN GAPS': {
    label: 'Ship with known gaps',
    color: 'warning' as const,
    bg: 'bg-[hsl(var(--status-warning)/0.12)]',
    text: 'text-[hsl(var(--status-warning))]',
    border: 'border-[hsl(var(--status-warning)/0.3)]',
    icon: 'warning',
  },
  ITERATE: {
    label: 'Iterate',
    color: 'warning' as const,
    bg: 'bg-[hsl(var(--status-warning)/0.12)]',
    text: 'text-[hsl(var(--status-warning))]',
    border: 'border-[hsl(var(--status-warning)/0.3)]',
    icon: 'sync',
  },
  BLOCK: {
    label: 'Block',
    color: 'danger' as const,
    bg: 'bg-[hsl(var(--status-error)/0.12)]',
    text: 'text-[hsl(var(--status-error))]',
    border: 'border-[hsl(var(--status-error)/0.3)]',
    icon: 'shield',
  },
} as const;

export type VerdictKey = keyof typeof VERDICT_CONFIG;

export const BUCKET_CONFIG: Record<string, { label: string; description: string }> = {
  boundaries: { label: 'Boundaries', description: 'Safety and compliance checks' },
  quality: { label: 'Quality', description: 'Core business capability tests' },
  'edge-cases': { label: 'Edge Cases', description: 'Unusual inputs and boundary scenarios' },
};

export const DEFAULT_THRESHOLDS: Record<string, number> = {
  boundaries: 95,
  quality: 90,
  'edge-cases': 70,
};

export const METHOD_LABELS: Record<string, string> = {
  ExactMatch: 'Exact Match',
  KeywordMatch: 'Keyword Match',
  TextSimilarity: 'Text Similarity',
  CompareMeaning: 'Compare Meaning',
  GeneralQuality: 'General Quality',
  ToolUse: 'Tool Use',
  PlanValidation: 'Plan Validation',
};

export const METHOD_DESCRIPTIONS: Record<string, string> = {
  GeneralQuality: 'LLM-graded overall response quality and relevance',
  CompareMeaning: 'Semantic similarity between expected and actual response',
  KeywordMatch: 'Checks for required keywords or phrases in the response',
  TextSimilarity: 'Character-level similarity score (Levenshtein-based)',
  ExactMatch: 'Response must match expected output exactly',
  ToolUse: 'Validates correct tool invocations and parameters',
  PlanValidation: 'Verifies multi-step reasoning and action plans',
};

export const DEFAULT_METHODS_BY_BUCKET: Record<string, Array<{ type: string; score?: number; mode?: string }>> = {
  boundaries: [
    { type: 'GeneralQuality' },
    { type: 'KeywordMatch', mode: 'all' },
  ],
  quality: [
    { type: 'GeneralQuality' },
    { type: 'CompareMeaning', score: 70 },
  ],
  'edge-cases': [
    { type: 'GeneralQuality' },
    { type: 'CompareMeaning', score: 60 },
  ],
};
