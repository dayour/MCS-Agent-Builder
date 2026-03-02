/**
 * Raw API response types — matches what server.py returns.
 * These map 1:1 to brief.json on disk.
 */

export interface ApiProject {
  id: string;
  name: string;
  path: string;
  agents: ApiAgentSummary[];
  doc_count: number;
  stage: string;
  created_at: string;
}

export interface ApiProjectDetail {
  id: string;
  name: string;
  path: string;
  agents: ApiAgentSummary[];
  docs: ApiDoc[];
  doc_content: Record<string, string>;
  stage: string;
}

export interface ApiAgentSummary {
  id: string;
  name: string;
  description: string;
  has_brief: boolean;
  has_instructions: boolean;
  has_evals: boolean;
  has_build_report: boolean;
  readiness: number;
  build_ready: boolean;
  eval_pass_rate: number | null;
  folder: string;
  architecture_type?: string;
  architecture_children?: string[];
}

export interface ApiAgentDetail {
  id: string;
  name: string;
  brief: ApiBrief | null;
  /** Filesystem mtime of brief.json — detects external edits (Claude, manual). */
  _file_mtime?: string;
  has_instructions: boolean;
  has_evals: boolean;
  has_build_report: boolean;
}

export interface ApiDoc {
  filename: string;
  size: number;
  isNew?: boolean;
  isModified?: boolean;
}

export interface ApiDocStatus {
  hasManifest: boolean;
  lastResearchAt: string | null;
  newDocs: string[];
  changedDocs: string[];
  deletedDocs: string[];
  needsUpdate: boolean;
}

export interface ApiUploadResult {
  uploaded: boolean;
  filename: string;
  conversionError?: string | null;
  size: number;
  path: string;
  briefOutdated: boolean;
}

export interface ApiPasteResult {
  saved: boolean;
  filename: string;
  size: number;
  path: string;
}

// ─── Raw brief.json shape ──────────────────────────────────────────

export interface ApiBrief {
  _schema?: string;
  business?: {
    useCase?: string;
    problemStatement?: string;
    challenges?: Array<{ challenge: string; impact?: string }>;
    benefits?: Array<{ benefit: string; type?: string }>;
    successCriteria?: Array<{ metric: string; target: string; measurement?: string }>;
    stakeholders?: { sponsor?: string; owner?: string; users?: string };
  };
  agent?: {
    name?: string;
    description?: string;
    persona?: string;
    responseFormat?: string;
    primaryUsers?: string;
    secondaryUsers?: string;
  };
  capabilities?: Array<{
    name: string;
    phase?: string;
    reason?: string;
    description?: string;
    dataSources?: string[];
    status?: string;
  }>;
  integrations?: Array<{
    name: string;
    type?: string;
    purpose?: string;
    dataProvided?: string;
    authMethod?: string;
    status?: string;
    phase?: string;
    notes?: string;
  }>;
  knowledge?: Array<{
    name: string;
    type?: string;
    purpose?: string;
    scope?: string;
    status?: string;
    phase?: string;
  }>;
  conversations?: {
    topics?: Array<{
      name: string;
      schemaName?: string;
      description?: string;
      triggerType?: string;
      triggerPhrases?: string[];
      topicType?: string;
      phase?: string;
      implements?: string[];
      variables?: Array<{ name: string; type: string; prompt: string; required: boolean }>;
      connectedIntegrations?: string[];
      outputFormat?: string;
      yaml?: string | null;
    }>;
  };
  boundaries?: {
    handle?: string[];
    decline?: Array<{ topic: string; redirect?: string }>;
    refuse?: Array<{ topic: string; reason?: string }>;
  };
  architecture?: {
    type?: string;
    factors?: Record<string, boolean | { value: boolean; reasoning?: string }>;
    score?: number;
    reason?: string;
    typeReasoning?: string;
    triggers?: Array<{ type: string; description: string }>;
    channels?: Array<{ name: string; reason?: string }>;
    children?: Array<{ name: string; role: string; routingRule?: string; model?: string; agentFolderId?: string }>;
  };
  evalSets?: Array<{
    name: string;
    description?: string;
    methods?: Array<{
      type: string;
      score?: number;
      mode?: string;
    }>;
    passThreshold?: number;
    runWhen?: string;
    tests?: Array<{
      question: string;
      expected?: string;
      capability?: string;
      methods?: Array<{ type: string; score?: number; mode?: string }> | null;
      scenarioId?: string | null;
      scenarioCategory?: string | null;
      coverageTag?: string | null;
      turns?: Array<{ question: string; expected?: string | null; critical?: boolean }> | null;
      expectedTools?: string | null;
      toolThreshold?: number | null;
      lastResult?: {
        pass: boolean;
        actual?: string;
        score?: number;
        timestamp?: string;
        turnResults?: Array<{
          turnIndex: number;
          question: string;
          critical: boolean;
          pass: boolean | null;
          score: number | null;
          actual?: string;
        }>;
        toolInvocations?: string[];
      } | null;
    }>;
  }>;
  evalCoverage?: {
    lastAnalyzed?: string;
    scenariosCovered?: string[];
    scenariosRecommended?: string[];
    coverageDistribution?: Record<string, number>;
    gaps?: Array<{ categoryId: string; reason: string }>;
  } | null;
  evalConfig?: {
    targetPassRate?: number;
    maxIterationsPerCapability?: number;
    maxRegressionRounds?: number;
  };
  /** @deprecated Use evalSets instead — kept for migration */
  scenarios?: Array<{
    name?: string;
    category?: string;
    userSays?: string;
    agentDoes?: string;
    capabilities?: string[];
  }>;
  /** @deprecated Use evalSets instead — kept for migration */
  evals?: Array<{
    question: string;
    expected: string;
    method?: string;
    score?: string;
    category?: string;
    capability?: string;
  }>;
  recommendations?: Array<{
    category: string;
    text: string;
    source?: string;
  }>;
  openQuestions?: Array<{
    question: string;
    impact?: string;
    section?: string;
    suggestedDefault?: string;
    answer?: string;
  }>;
  instructions?: string;
  mvpSummary?: {
    now?: string[];
    future?: string[];
    blockers?: string[];
  };
  buildStatus?: {
    status?: string;
    lastBuild?: string;
    mcsAgentId?: string;
    environment?: string;
    account?: string;
    publishedAt?: string;
  };
  /** @deprecated Eval results now live in evalSets[].tests[].lastResult */
  evalResults?: {
    lastRun?: string;
    method?: string;
    summary?: { total: number; passed: number; failed: number; passRate: string };
    results?: Array<{
      question: string;
      expected: string;
      actual: string;
      pass: boolean;
      score: number;
      method: string;
    }>;
  };
  updated_at?: string;
}
