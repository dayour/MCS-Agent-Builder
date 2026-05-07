export interface EvalMethodConfig {
  type: 'ExactMatch' | 'KeywordMatch' | 'TextSimilarity' | 'CompareMeaning' | 'GeneralQuality' | 'ToolUse' | 'PlanValidation';
  score?: number;
  mode?: string;
}

export interface EvalMethodResult {
  method: string;
  pass: boolean;
  score: number;
}

export interface EvalTurnResult {
  turnIndex: number;
  pass: boolean;
  score: number;
  actual: string;
  critical: boolean;
}

export interface EvalTestResult {
  pass: boolean;
  actual: string;
  score: number;
  timestamp: string;
  methodResults: EvalMethodResult[];
  turnResults?: EvalTurnResult[];
  toolInvocations?: string[];
}

export interface EvalTest {
  question: string;
  expected: string;
  keywords?: string;
  capability?: string;
  scenarioId?: string;
  scenarioCategory?: string;
  source?: string;
  turns?: Array<{ turnIndex: number; question: string; expected: string; critical: boolean }>;
  expectedTools?: string;
  lastResult: EvalTestResult | null;
}

export interface EvalSet {
  name: string;
  description?: string;
  methods: EvalMethodConfig[];
  passThreshold: number;
  tests: EvalTest[];
}

export interface EvalVerdict {
  verdict: 'SHIP' | 'SHIP WITH KNOWN GAPS' | 'ITERATE' | 'BLOCK';
  reason: string;
  overallRate: number;
  perSet: Array<{ name: string; rate: number }>;
}

export interface EvalConfig {
  verdictModel: string;
  riskProfile: string;
  lastVerdict?: EvalVerdict;
  lastVerdictAt?: string;
}

export interface BucketStats {
  name: string;
  description?: string;
  passThreshold: number;
  totalTests: number;
  testedCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  meetsThreshold: boolean;
  methods: EvalMethodConfig[];
  tests: EvalTest[];
}
