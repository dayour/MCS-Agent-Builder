import { AgentConfig, AgentCapability, APIConnection } from '../../../types';

// ─── Shared constants ─────────────────────────────────────────────────────────

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DANodeType = 'topic' | 'knowledge' | 'agent' | 'skill' | 'flow' | 'connector' | 'prompt' | 'tool';
export type DANodeStatus = 'rest' | 'loading' | 'completed';

export type CoTQueryType = 'status' | 'procedural' | 'factual' | 'analytical' | 'diagnostic' | 'general';

export interface CoTClassification {
  queryType: CoTQueryType;
  label: string;
  description: string;
  detectedKeywords: string[];
}

export interface DACoTSource {
  id: string;
  name: string;
  type: 'file' | 'url' | 'sharepoint' | 'dataverse';
}

export interface DACoTInlinePill {
  before: string;
  label: string;
  /** Icon/color variant of the pill */
  type: 'topic' | 'knowledge' | 'connector';
  after: string;
}

export interface DACoTStep {
  title: string;
  description?: string;
  /** Renders an inline clickable pill mid-sentence */
  inlinePill?: DACoTInlinePill;
  sources?: DACoTSource[];
  cycle?: number;
  /** If present, renders a gray input/output data box below the description */
  fields?: Array<{ key: string; value: string }>;
  /** Label shown above the fields box, e.g. "Inputs" or "Output" */
  fieldsLabel?: string;
  /** Raw text lines rendered in a code-style box (no key-value formatting) */
  rawLines?: string[];
  /** @deprecated kept for backward compat with saved sessions */
  isDetail?: boolean;
}

export interface DANodeDetails {
  description?: string;
  fields?: Array<{ key: string; value: string }>;
  responseTimeMs: number;
  tokens?: number;
}

export interface DANode {
  id: string;
  type: DANodeType;
  name: string;
  status: DANodeStatus;
  steps: DACoTStep[];
  errorTitle?: string;
  error?: string;
  details?: DANodeDetails;
}

/**
 * A single node as returned by the LLM's <copilot_trace> output.
 * Used by buildNodesFromLLMTrace to produce real DANode[].
 */
export interface LLMTraceNode {
  type: DANodeType;
  name: string;
  outcome: 'success' | 'limited' | 'failed';
  detail: string;
  /** Only for knowledge nodes — the actual source names searched */
  sources?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seededNum(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return min + (Math.abs(hash) % (max - min + 1));
}

const QUESTION_PREFIXES = [
  'what is ', 'what are ', 'what does ', 'what do ', 'how do i ', 'how does ',
  'how to ', 'can you ', 'could you ', 'please ', 'tell me ', 'explain ',
  'show me ', 'help me ', 'i need ', 'i want ',
];

function topicGuess(query: string): string {
  let text = query.trim().replace(/[?.!,;:]+$/, '').trim();
  const lower = text.toLowerCase();
  for (const prefix of QUESTION_PREFIXES) {
    if (lower.startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > 40) return text.slice(0, 37) + '...';
  return text || 'General inquiry';
}

function detectGreetingTopic(query: string): string {
  const lower = query.toLowerCase().trim();
  if (['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'].some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return 'Acknowledge user greeting';
  if (['thanks', 'thank you', 'thx'].some(g => lower.includes(g))) return 'Acknowledge user thanks';
  if (['bye', 'goodbye', 'see you', 'talk later'].some(g => lower.includes(g))) return 'Acknowledge user farewell';
  if (['yes', 'sure', 'okay', 'ok', 'yep', 'yup', 'sounds good', 'got it'].some(g => lower === g || lower.startsWith(g + ' '))) return 'Confirm user response';
  if (['no', 'nope', 'nah', 'not really'].some(g => lower === g || lower.startsWith(g + ' '))) return 'Acknowledge user decline';
  return 'Conversational response';
}

// ─── Query Classifier ─────────────────────────────────────────────────────────

export function classifyQuery(query: string): CoTClassification {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/);

  const match = (keywords: string[]) => keywords.filter(k => lower.includes(k));

  const greetings = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay', 'yes', 'no', 'sure', 'great', 'cool', 'nice', 'got it', 'sounds good'];
  if (words.length <= 4 && greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g))) {
    return { queryType: 'general', label: 'General', description: 'Simple conversational message', detectedKeywords: [] };
  }

  const statusKeywords = ['health', 'status', 'state', 'overall', 'progress', 'at risk', 'on track', 'overview', 'summary', 'how is the', 'situation', 'update on'];
  const statusMatches = match(statusKeywords);
  if (statusMatches.length > 0) {
    return { queryType: 'status', label: 'Status check', description: 'Queries current state, health, or progress', detectedKeywords: statusMatches };
  }

  const diagnosticKeywords = ['error', 'issue', 'problem', 'bug', 'troubleshoot', 'debug', 'why is', 'why does', 'not working', 'failed', 'broken', 'crash', 'incident', 'failing'];
  const diagnosticMatches = match(diagnosticKeywords);
  if (diagnosticMatches.length > 0) {
    return { queryType: 'diagnostic', label: 'Diagnostic', description: 'Troubleshooting or root cause analysis', detectedKeywords: diagnosticMatches };
  }

  const proceduralKeywords = ['how to', 'how do i', 'steps to', 'guide', 'configure', 'setup', 'set up', 'create', 'implement', 'build', 'install', 'enable', 'disable', 'fix', 'resolve', 'submit', 'request', 'apply', 'book', 'schedule', 'register'];
  const proceduralMatches = match(proceduralKeywords);
  if (proceduralMatches.length > 0) {
    return { queryType: 'procedural', label: 'Procedural', description: 'Requests step-by-step guidance or instructions', detectedKeywords: proceduralMatches };
  }

  const analyticalKeywords = ['analyze', 'analyse', 'compare', 'contrast', 'evaluate', 'assess', 'review', 'performance', 'metrics', 'trends', 'pattern', 'insight', 'forecast', 'predict', 'report'];
  const analyticalMatches = match(analyticalKeywords);
  if (analyticalMatches.length > 0) {
    return { queryType: 'analytical', label: 'Analytical', description: 'Requests data analysis, comparison, or evaluation', detectedKeywords: analyticalMatches };
  }

  const factualKeywords = ['what is', 'what are', 'what does', 'define', 'definition', 'meaning', 'who is', 'when is', 'where is', 'tell me about', 'explain', 'describe', 'more about', 'policy', 'policy on', 'rules', 'guidelines'];
  const factualMatches = match(factualKeywords);
  if (factualMatches.length > 0) {
    return { queryType: 'factual', label: 'Factual lookup', description: 'Requests specific facts, definitions, or explanations', detectedKeywords: factualMatches };
  }

  return { queryType: 'factual', label: 'Factual lookup', description: 'General informational query', detectedKeywords: [] };
}

// ─── Config Matching ──────────────────────────────────────────────────────────

/** Score how well a text string matches a user query (word overlap, ignoring stopwords) */
function scoreMatch(query: string, text: string): number {
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'this', 'that', 'with', 'from', 'by', 'me', 'my', 'i', 'you', 'we', 'our', 'can', 'do', 'how', 'what', 'when', 'where', 'please', 'help']);
  const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopwords.has(w));
  const textLower = text.toLowerCase();
  return queryWords.filter(w => textLower.includes(w)).length;
}

/**
 * Extract a short topic label from a guideline string.
 * e.g. "When users ask about leave requests, help them submit..." → "Leave request"
 * e.g. "Always respond professionally to complaints" → "Complaints"
 */
function extractTopicLabel(guideline: string): string {
  const patterns = [
    /when(?:\s+(?:a\s+)?user(?:s)?)?(?:\s+ask(?:s)?)?(?:\s+about)?\s+(.+?)(?:,|\.|\s+(?:help|guide|assist|direct|handle|provide|use|check))/i,
    /handle\s+(.+?)(?:\s+(?:by|through|via|with)|[,.:]|$)/i,
    /for\s+(.+?)\s+(?:queries|questions|requests|topics|issues)/i,
    /(?:topic|subject|area)[:]\s+(.+?)(?:[,.]|$)/i,
    /respond\s+to\s+(.+?)(?:\s+(?:with|by|using)|[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = guideline.match(pat);
    if (m) {
      let label = m[1].trim().replace(/[?,!;]+$/, '').trim();
      if (label.length > 40) label = label.slice(0, 37) + '...';
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  // Fallback: take first 6 meaningful words
  const words = guideline.replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/).filter(w => w.length > 2).slice(0, 5);
  return words.join(' ');
}

/**
 * Try to find a real topic name from the agent's guidelines, skills, or description.
 * Returns the label AND score so callers can branch on match strength.
 * Returns null if no confident match found.
 */
function matchTopicFromConfig(query: string, config: AgentConfig): { label: string; score: number } | null {
  let best: { label: string; score: number } | null = null;

  // 1. Match against guidelines
  for (const guideline of config.guidelines ?? []) {
    const score = scoreMatch(query, guideline);
    if (score >= 1) {
      const label = extractTopicLabel(guideline);
      if (label && label.length > 3 && (!best || score > best.score)) {
        best = { label, score };
      }
    }
  }

  // 2. Match against skills (exact skill names)
  for (const skill of config.skills ?? []) {
    const score = scoreMatch(query, skill);
    if (score >= 1 && (!best || score > best.score)) {
      best = { label: skill, score };
    }
  }

  // 3. Match against capability names (action type)
  for (const cap of config.capabilities ?? []) {
    if (cap.type === 'action' || cap.type === 'knowledge') continue; // handled elsewhere
    const score = scoreMatch(query, cap.name + ' ' + (cap.description ?? ''));
    if (score >= 1 && (!best || score > best.score)) {
      best = { label: cap.name, score };
    }
  }

  return best && best.score >= 1 ? best : null;
}

/**
 * Find the best matching action/connector capability for the user query.
 */
function matchCapabilityToQuery(query: string, capabilities: AgentCapability[] | undefined): AgentCapability | null {
  if (!capabilities?.length) return null;
  const actionCaps = capabilities.filter(c => c.type === 'action' || c.type === 'connector');
  if (!actionCaps.length) return null;

  let best: { cap: AgentCapability; score: number } | null = null;
  for (const cap of actionCaps) {
    const score = scoreMatch(query, cap.name + ' ' + (cap.description ?? '') + ' ' + (cap.source ?? ''));
    if (score >= 1 && (!best || score > best.score)) {
      best = { cap, score };
    }
  }
  return best ? best.cap : null;
}

/**
 * Find the best matching skill for the user query.
 */
function matchSkillToQuery(query: string, skills: string[] | undefined): string | null {
  if (!skills?.length) return null;
  let best: { skill: string; score: number } | null = null;
  for (const skill of skills) {
    const score = scoreMatch(query, skill);
    if (score >= 1 && (!best || score > best.score)) {
      best = { skill, score };
    }
  }
  return best ? best.skill : null;
}

/**
 * Find the best matching API connector for the user query.
 */
function matchApiToQuery(query: string, apis: APIConnection[] | undefined): APIConnection | null {
  if (!apis?.length) return null;
  const active = apis.filter(a => a.enabled);
  if (!active.length) return null;
  let best: { api: APIConnection; score: number } | null = null;
  for (const api of active) {
    const score = scoreMatch(query, api.name + ' ' + api.endpoint);
    if (score >= 1 && (!best || score > best.score)) {
      best = { api, score };
    }
  }
  // If no keyword match but there are active APIs, return the first one for status queries
  return best ? best.api : active[0];
}

// ─── Node Builders ────────────────────────────────────────────────────────────

function buildTopicNode(query: string, queryType: CoTQueryType, topicName?: string | null): DANode {
  const topic = topicName ?? (queryType === 'general' ? detectGreetingTopic(query) : topicGuess(query));
  const seed = query.slice(0, 20);
  const ms = seededNum(seed + 'rt', 160, 340);
  const tokens = seededNum(seed + 'tok', 75, 155);
  const shortQuery = query.length > 60 ? query.slice(0, 60) + '…' : query;

  const steps: DACoTStep[] = [
    {
      title: 'Interpreting topic intent',
      inlinePill: { before: 'The agent determined that the ', label: topic, type: 'topic', after: ' topic was relevant to handle the current user request.' },
    },
    {
      title: 'Preparing topic context',
      fieldsLabel: 'Inputs',
      fields: [{ key: 'query', value: `"${shortQuery}"` }],
    },
    {
      title: 'Executing topic flow',
      inlinePill: { before: 'The agent invoked the ', label: topic, type: 'topic', after: ' topic and executed its internal dialog and logic.' },
    },
    {
      title: 'Processing topic outcome',
      description: 'The topic execution completed and produced an outcome for downstream processing.',
    },
    {
      title: 'Generated result',
      fieldsLabel: 'Output',
      fields: [{ key: 'output', value: `"${topic} response"` }],
    },
    {
      title: 'Execution summary',
      description: `Topic matched and executed successfully in ${ms}ms, consuming ${tokens} tokens.`,
    },
  ];

  return {
    id: 'topic-1',
    type: 'topic',
    name: topic,
    status: 'rest',
    steps,
  };
}

function buildKnowledgeNode(query: string, config: AgentConfig, twoPass: boolean): DANode {
  const seed = query.slice(0, 20);
  const topic = topicGuess(query);
  const ms = seededNum(seed + 'krt', 900, 2200);
  const tokens = seededNum(seed + 'ktok', 380, 820);

  const sources: DACoTSource[] = [];
  if (config.knowledge?.files?.length) {
    config.knowledge.files.slice(0, 3).forEach(f => sources.push({ id: f.id, name: f.name, type: 'file' }));
  }
  // Use real knowledge capability names if available
  const knowledgeCaps = config.capabilities?.filter(c => c.type === 'knowledge') ?? [];
  if (knowledgeCaps.length) {
    knowledgeCaps.slice(0, 3).forEach((cap, i) => {
      const sourceType: DACoTSource['type'] =
        cap.source?.toLowerCase().includes('sharepoint') ? 'sharepoint'
        : cap.source?.toLowerCase().includes('dataverse') ? 'dataverse'
        : 'file';
      sources.push({ id: `kc-${i}`, name: cap.name, type: sourceType });
    });
  } else {
    if (config.knowledge?.webSearch) sources.push({ id: 'web-1', name: 'Web search results', type: 'url' });
    if (config.knowledge?.specificSources) sources.push({ id: 'sp-1', name: 'SharePoint library', type: 'sharepoint' });
  }
  if (sources.length === 0) sources.push({ id: 'kb-1', name: 'Knowledge base', type: 'file' });

  const docsFound = seededNum(seed + 'docs', 2, 5);
  const citationsAdded = Math.min(docsFound, seededNum(seed + 'cit', 1, 3));
  const citedSources = sources.slice(0, citationsAdded);

  const steps: DACoTStep[] = [
    {
      title: 'Refining knowledge query',
      description: `Review ${topic.toLowerCase()} related information. Including references to relevant documents and context needed to address the query.`,
    },
    {
      title: 'Search',
      description: `Search across all configured knowledge sources for references to ${topic.toLowerCase()} related content and relevant documentation.`,
      cycle: 1,
    },
    {
      title: 'Filter knowledge sources',
      description: `Narrow search to sources that potentially contain language related to ${topic.toLowerCase()}.`,
      sources,
      cycle: 1,
    },
    {
      title: 'Read filtered knowledge sources',
      description: `Open the most relevant documents to identify sections referencing ${topic.toLowerCase()}. Open additional documents if relevant content is detected.`,
      cycle: 1,
    },
  ];

  if (twoPass) {
    steps.push(
      {
        title: 'Search',
        description: `Refine search within previously identified sources to validate explicit information for ${topic.toLowerCase()}.`,
        cycle: 2,
      },
      {
        title: 'Filter knowledge sources',
        description: `Further narrow results to specific sections mentioning key terms related to the query.`,
        sources,
        cycle: 2,
      },
      {
        title: 'Read filtered knowledge sources',
        description: `Open the relevant sections within identified documents to confirm scope, limitations, and key details.`,
        cycle: 2,
      },
    );
  }

  steps.push(
    {
      title: `Summarized ${topic} analysis`,
      description: `Identify relevant information about ${topic.toLowerCase()}. Noting any conditions, limitations, and key details found across sources.`,
      sources: citedSources,
    },
    {
      title: 'Crafting final response',
      description: `Composing a comprehensive answer about ${topic.toLowerCase()} based on ${citationsAdded} retrieved knowledge source${citationsAdded !== 1 ? 's' : ''}.`,
    },
    {
      title: 'Execution summary',
      description: `${topic} knowledge search completed successfully in ${ms}ms, using ${tokens} tokens.`,
    },
  );

  return {
    id: 'knowledge-1',
    type: 'knowledge',
    name: 'Knowledge search',
    status: 'rest',
    steps,
  };
}

function buildActionNode(capability: AgentCapability, query: string): DANode {
  const seed = query.slice(0, 20);
  const dataDomain = topicGuess(query);
  const ms = seededNum(seed + 'art', 380, 1100);
  const tokens = seededNum(seed + 'atk', 95, 210);
  const source = capability.source ?? capability.name;

  return {
    id: 'action-1',
    type: 'connector',
    name: capability.name,
    status: 'rest',
    steps: [
      {
        title: 'Interpreting connector intent',
        inlinePill: { before: 'The agent determined that invoking the ', label: capability.name, type: 'connector', after: ' connector was required to fulfill the request.' },
      },
      {
        title: 'Selecting the appropriate connector',
        inlinePill: { before: 'The agent identified and used the ', label: capability.name, type: 'connector', after: ` connector to retrieve ${dataDomain} data from the connected system.` },
      },
      {
        title: 'Preparing the connector query',
        fieldsLabel: 'Inputs',
        fields: [{ key: 'Input', value: `"${dataDomain}"` }],
      },
      {
        title: 'Executing the connector request',
        description: capability.description ?? `The agent sent a request to ${source} through the connector.`,
        rawLines: [`POST /api/${source.toLowerCase().replace(/\s+/g, '-')}/action`],
      },
      {
        title: 'Processing the connector response',
        description: `The connector responded in ${ms} ms, using ${tokens} tokens during processing.`,
        rawLines: [`200 OK`, `Action completed successfully`],
      },
      {
        title: 'Generating the final response',
        description: `Using the retrieved ${dataDomain} data, the agent generated a response for the user.`,
        fieldsLabel: 'Output',
        fields: [{ key: 'Output', value: `"${capability.name} result"` }],
      },
      {
        title: 'Execution summary',
        description: `${capability.name} completed successfully in ${ms}ms, consuming ${tokens} tokens.`,
      },
    ],
  };
}

function buildSkillNode(skillName: string, query: string): DANode {
  const seed = query.slice(0, 20);
  const ms = seededNum(seed + 'srt', 280, 760);
  const tokens = seededNum(seed + 'stk', 120, 340);
  const shortQuery = query.length > 60 ? query.slice(0, 60) + '…' : query;

  return {
    id: 'skill-1',
    type: 'skill',
    name: skillName,
    status: 'rest',
    steps: [
      {
        title: 'Matching skill to request',
        inlinePill: { before: 'The agent matched the ', label: skillName, type: 'topic', after: ' skill to the current user request.' },
      },
      {
        title: 'Preparing skill inputs',
        fieldsLabel: 'Inputs',
        fields: [{ key: 'query', value: `"${shortQuery}"` }],
      },
      {
        title: `Executing ${skillName}`,
        description: `Running the ${skillName} skill to process the request and generate the appropriate output.`,
      },
      {
        title: 'Skill result',
        fieldsLabel: 'Output',
        fields: [{ key: 'result', value: `"${skillName} output"` }],
      },
      {
        title: 'Execution summary',
        description: `${skillName} completed successfully in ${ms}ms, consuming ${tokens} tokens.`,
      },
    ],
  };
}

function buildApiConnectorNode(api: APIConnection, query: string): DANode {
  const seed = query.slice(0, 20);
  const ms = seededNum(seed + 'crt', 380, 1100);
  const tokens = seededNum(seed + 'ctok', 95, 210);
  const recordsReturned = seededNum(seed + 'rec', 4, 16);
  const dataDomain = topicGuess(query);

  return {
    id: 'connector-1',
    type: 'connector',
    name: api.name,
    status: 'rest',
    steps: [
      {
        title: 'Interpreting connector intent',
        inlinePill: { before: 'The agent determined that invoking the ', label: api.name, type: 'connector', after: ' connector was required to fulfill the request.' },
      },
      {
        title: 'Selecting the appropriate connector',
        inlinePill: { before: 'The agent identified and used the ', label: api.name, type: 'connector', after: ` connector to retrieve ${dataDomain} data from the connected system.` },
      },
      {
        title: 'Preparing the connector query',
        fieldsLabel: 'Inputs',
        fields: [
          { key: 'Input', value: `"${dataDomain}"` },
        ],
      },
      {
        title: 'Executing the connector request',
        description: 'The agent sent a request to the external system through the connector.',
        rawLines: [`GET ${api.endpoint}`],
      },
      {
        title: 'Processing the connector response',
        description: `The connector responded in ${ms} ms, using ${tokens} tokens during processing.`,
        rawLines: [`200 OK`, `${recordsReturned} records retrieved successfully`],
      },
      {
        title: 'Generating the final response',
        description: `Using the retrieved ${dataDomain} data, the agent generated a response for the user.`,
        fieldsLabel: 'Output',
        fields: [
          { key: 'Output', value: `"${api.name} response"` },
          { key: 'records', value: String(recordsReturned) },
        ],
      },
      {
        title: 'Execution summary',
        description: `${api.name} returned ${recordsReturned} records successfully in ${ms}ms, consuming ${tokens} tokens.`,
      },
    ],
    details: {
      fields: [
        { key: 'Endpoint', value: api.endpoint },
        { key: 'Method', value: 'GET' },
        { key: 'Auth', value: 'OAuth 2.0' },
        { key: 'Records returned', value: String(recordsReturned) },
        { key: 'Connection status', value: 'Connected' },
      ],
      responseTimeMs: ms,
      tokens,
    },
  };
}

function buildFallbackConnectorNode(query: string): DANode {
  const seed = query.slice(0, 20);
  const dataDomain = topicGuess(query);
  const topicLower = dataDomain.toLowerCase();
  const endpoint = topicLower.includes('project') ? '/api/projects/status'
    : topicLower.includes('report') ? '/api/reports/latest'
    : topicLower.includes('metric') || topicLower.includes('analytic') ? '/api/metrics/summary'
    : '/api/data/status';
  const recordsReturned = seededNum(seed + 'rec', 4, 16);
  const ms = seededNum(seed + 'crt', 380, 1100);
  const tokens = seededNum(seed + 'ctok', 95, 210);
  const connectorName = 'Data connector';

  return {
    id: 'connector-1',
    type: 'connector',
    name: connectorName,
    status: 'rest',
    steps: [
      {
        title: 'Interpreting connector intent',
        inlinePill: { before: 'The agent determined that invoking the ', label: connectorName, type: 'connector', after: ' connector was required to fulfill the request.' },
      },
      {
        title: 'Selecting the appropriate connector',
        inlinePill: { before: 'The agent identified and used the ', label: connectorName, type: 'connector', after: ` connector to retrieve ${dataDomain} data from the connected system.` },
      },
      {
        title: 'Preparing the connector query',
        fieldsLabel: 'Inputs',
        fields: [
          { key: 'Input', value: `"${dataDomain}"` },
        ],
      },
      {
        title: 'Executing the connector request',
        description: 'The agent sent a request to the external system through the connector.',
        rawLines: [`GET ${endpoint}`],
      },
      {
        title: 'Processing the connector response',
        description: `The connector responded in ${ms} ms, using ${tokens} tokens during processing.`,
        rawLines: [`200 OK`, `${recordsReturned} records retrieved successfully`],
      },
      {
        title: 'Generating the final response',
        description: `Using the retrieved ${dataDomain} data, the agent generated a response for the user.`,
        fieldsLabel: 'Output',
        fields: [
          { key: 'Output', value: `"${dataDomain} response"` },
          { key: 'records', value: String(recordsReturned) },
        ],
      },
      {
        title: 'Execution summary',
        description: `${connectorName} returned ${recordsReturned} records successfully in ${ms}ms, consuming ${tokens} tokens.`,
      },
    ],
    details: {
      fields: [
        { key: 'Endpoint', value: endpoint },
        { key: 'Method', value: 'GET' },
        { key: 'Auth', value: 'OAuth 2.0' },
        { key: 'Records returned', value: String(recordsReturned) },
        { key: 'Connection status', value: 'Connected' },
      ],
      responseTimeMs: ms,
      tokens,
    },
  };
}

function buildPromptNode(query: string): DANode {
  const seed = query.slice(0, 20);
  const contextTokens = seededNum(seed + 'ctx', 900, 2100);
  const responseTokens = seededNum(seed + 'res', 280, 680);

  return {
    id: 'prompt-1',
    type: 'prompt',
    name: 'Generative response',
    status: 'rest',
    steps: [
      { title: 'Assembling conversation context', description: `Collecting retrieved content and conversation history — ${contextTokens.toLocaleString()} tokens assembled.` },
      { title: 'Constructing synthesis prompt', description: 'Combining retrieved information with instructions to build a grounded synthesis prompt.' },
      { title: 'Generating response with grounding', description: `Generating analytical response using ${seededNum(seed + 'gc', 1, 3)} grounded citation${seededNum(seed + 'gc', 1, 3) !== 1 ? 's' : ''} from retrieved sources.` },
      { title: 'Verifying citations and formatting', description: `Response verified and formatted. ${responseTokens.toLocaleString()} tokens generated.` },
    ],
    details: {
      fields: [
        { key: 'Context tokens', value: contextTokens.toLocaleString() },
        { key: 'Model tier', value: 'balanced' },
        { key: 'Temperature', value: '0.7' },
        { key: 'Response tokens', value: responseTokens.toLocaleString() },
        { key: 'Grounded citations', value: String(seededNum(seed + 'gc', 1, 3)) },
        { key: 'Connection status', value: 'Connected' },
      ],
      responseTimeMs: seededNum(seed + 'prt', 750, 1900),
      tokens: contextTokens + responseTokens,
    },
  };
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates a realistic sequence of DANodes for a given agent config and user query.
 *
 * Routing logic mirrors Copilot Studio backend behavior:
 * 1. Topic node — matched to a real guideline, skill, or capability from the agent config
 * 2. Action/Connector node — if the agent has a capability or API matching the query
 * 3. Skill node — if the agent has a skill matching the query (and no action matched)
 * 4. Knowledge node — if the agent has knowledge sources and the query needs retrieval
 * 5. Prompt node — for analytical/synthesis queries
 *
 * Priority for secondary node:
 *   action capability > API connector > skill > knowledge > (nothing)
 */
export function generateDACoTNodes(agentConfig: AgentConfig, userQuery: string): DANode[] {
  const { queryType } = classifyQuery(userQuery);

  // ── Simple conversational: single topic ──
  if (queryType === 'general') {
    return [buildTopicNode(userQuery, 'general')];
  }

  // ── Resolve config resources ──
  const topicMatch = matchTopicFromConfig(userQuery, agentConfig);
  const matchedTopicLabel = topicMatch?.label ?? null;
  // A matched topic means Copilot Studio routes the query through a dialog flow —
  // no knowledge fallback needed (the topic handles it internally).
  const hasTopicMatch = topicMatch !== null;

  const matchedCapability = matchCapabilityToQuery(userQuery, agentConfig.capabilities);
  const matchedSkill = matchSkillToQuery(userQuery, agentConfig.skills);
  const matchedApi = matchApiToQuery(userQuery, agentConfig.knowledge?.customAPIs);

  const hasKnowledge =
    (agentConfig.knowledge?.files?.length ?? 0) > 0 ||
    agentConfig.knowledge?.webSearch ||
    agentConfig.knowledge?.specificSources ||
    (agentConfig.capabilities?.some(c => c.type === 'knowledge') ?? false);

  // ── Build node chain ──
  // Topic node only appears when a specific topic is matched (Copilot Studio behavior).
  // No topic match → Conversational Boosting handles it silently; start directly with knowledge/connector.
  const nodes: DANode[] = [];
  if (hasTopicMatch) nodes.push(buildTopicNode(userQuery, queryType, matchedTopicLabel));

  // True only if the agent actually has connectors/APIs configured.
  const hasConnectorConfig =
    (agentConfig.knowledge?.customAPIs?.some(a => a.enabled) ?? false) ||
    (agentConfig.capabilities?.some(c => c.type === 'connector' || c.type === 'action') ?? false);

  switch (queryType) {
    case 'status':
      // Status always needs live data — connector takes priority over knowledge
      if (matchedApi) {
        nodes.push(buildApiConnectorNode(matchedApi, userQuery));
      } else if (matchedCapability) {
        nodes.push(buildActionNode(matchedCapability, userQuery));
      } else if (hasKnowledge) {
        nodes.push(buildKnowledgeNode(userQuery, agentConfig, false));
      } else if (hasConnectorConfig) {
        // Only show a fallback connector node if the agent has actual connector config,
        // not for pure knowledge or instructions-only agents.
        nodes.push(buildFallbackConnectorNode(userQuery));
      }
      break;

    case 'procedural':
      // Topic matched → topic dialog handles it internally (no extra node)
      // No topic match → skill or knowledge fallback
      if (matchedCapability) {
        nodes.push(buildActionNode(matchedCapability, userQuery));
      } else if (!hasTopicMatch) {
        if (matchedSkill) {
          nodes.push(buildSkillNode(matchedSkill, userQuery));
        } else if (hasKnowledge) {
          nodes.push(buildKnowledgeNode(userQuery, agentConfig, false));
        }
      }
      break;

    case 'analytical': {
      // Analytical: knowledge retrieval + prompt synthesis
      let hasDataNode = false;
      if (hasKnowledge) {
        nodes.push(buildKnowledgeNode(userQuery, agentConfig, true));
        hasDataNode = true;
      } else if (matchedApi) {
        nodes.push(buildApiConnectorNode(matchedApi, userQuery));
        hasDataNode = true;
      } else if (matchedCapability) {
        nodes.push(buildActionNode(matchedCapability, userQuery));
        hasDataNode = true;
      }
      // Only add prompt synthesis node when there's a preceding data node to synthesize from.
      if (hasDataNode) nodes.push(buildPromptNode(userQuery));
      break;
    }

    case 'factual':
    case 'diagnostic':
    default:
      // Factual / Diagnostic routing mirrors Copilot Studio:
      //   • Topic matched → topic dialog handles it; no knowledge fallback
      //   • Connector / action matched → connector node
      //   • No topic match → Conversational Boosting → knowledge search
      if (matchedCapability) {
        nodes.push(buildActionNode(matchedCapability, userQuery));
        if (hasKnowledge && !hasTopicMatch) nodes.push(buildKnowledgeNode(userQuery, agentConfig, false));
      } else if (!hasTopicMatch) {
        if (hasKnowledge) {
          nodes.push(buildKnowledgeNode(userQuery, agentConfig, queryType === 'diagnostic'));
        } else if (matchedSkill) {
          nodes.push(buildSkillNode(matchedSkill, userQuery));
        }
      }
      break;
  }

  return nodes;
}

// ─── LLM Trace → DANode[] ─────────────────────────────────────────────────────

/**
 * Convert the LLM's <copilot_trace> output into a proper DANode[] for the CoT visualization.
 * Each node type maps to its real Copilot Studio component with appropriate steps.
 * Falls back gracefully — unknown types produce a minimal generic node.
 */
export function buildNodesFromLLMTrace(traceNodes: LLMTraceNode[], query: string, turnId: string): DANode[] {
  const seed = query.slice(0, 20);

  return traceNodes.map((t, i) => {
    const id = `${turnId}-${t.type}-${i}`;
    const isFailed = t.outcome === 'failed';
    const isLimited = t.outcome === 'limited';
    const errorTitle = isFailed ? 'Action failed' : isLimited ? 'Limited result' : undefined;
    const errorMsg = isFailed || isLimited ? t.detail : undefined;

    switch (t.type) {
      case 'topic': {
        const ms = seededNum(seed + 'rt', 160, 340);
        const tokens = seededNum(seed + 'tok', 75, 155);
        return {
          id, type: 'topic', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Interpreting topic intent', inlinePill: { before: 'The agent determined that the ', label: t.name, type: 'topic' as const, after: ' topic was relevant to handle the current user request.' } },
            { title: 'Preparing topic context', fieldsLabel: 'Inputs', fields: [{ key: 'query', value: `"${query.length > 60 ? query.slice(0, 60) + '…' : query}"` }] },
            { title: 'Executing topic flow', inlinePill: { before: 'The agent invoked the ', label: t.name, type: 'topic' as const, after: ' topic and executed its internal dialog and logic.' } },
            { title: 'Processing topic outcome', description: t.detail || 'The topic execution completed and produced an outcome.' },
            { title: 'Execution summary', description: `${t.name} topic matched and executed successfully in ${ms}ms, consuming ${tokens} tokens.` },
          ],
          details: { responseTimeMs: ms, tokens },
        };
      }

      case 'knowledge': {
        const ms = seededNum(seed + 'krt', 900, 2200);
        const tokens = seededNum(seed + 'ktok', 380, 820);
        const sources: DACoTSource[] = (t.sources ?? []).map((name, j) => ({
          id: `llm-src-${j}`,
          name,
          type: name.toLowerCase().includes('sharepoint') ? 'sharepoint'
              : name.toLowerCase().includes('dataverse') ? 'dataverse'
              : name.toLowerCase().includes('web') || name.toLowerCase().includes('search') ? 'url'
              : 'file',
        }));
        if (sources.length === 0) sources.push({ id: 'kb-1', name: 'Knowledge base', type: 'file' });
        const topic = topicGuess(query);
        return {
          id, type: 'knowledge', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Refining knowledge query', description: t.detail || `Searching for ${topic.toLowerCase()} related information.` },
            { title: 'Search', description: `Searching across configured knowledge sources.`, cycle: 1 },
            { title: 'Filter knowledge sources', sources, cycle: 1 },
            { title: 'Read filtered knowledge sources', description: `Opening the most relevant documents to identify ${topic.toLowerCase()} information.`, cycle: 1 },
            { title: `Summarized ${topic} analysis`, description: `Identified relevant information. Noting conditions, limitations, and key details.`, sources: sources.slice(0, 2) },
            { title: 'Crafting final response', description: `Composing answer based on ${sources.length} retrieved source${sources.length !== 1 ? 's' : ''}.` },
            { title: 'Execution summary', description: `Knowledge search completed in ${ms}ms, using ${tokens} tokens.` },
          ],
          details: { responseTimeMs: ms, tokens },
        };
      }

      case 'connector': {
        const ms = seededNum(seed + 'art', 380, 1100);
        const tokens = seededNum(seed + 'atk', 95, 210);
        const topic = topicGuess(query);
        return {
          id, type: 'connector', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Interpreting connector intent', inlinePill: { before: 'The agent determined that invoking the ', label: t.name, type: 'connector' as const, after: ' connector was required to fulfill the request.' } },
            { title: 'Selecting the appropriate connector', inlinePill: { before: 'The agent identified and used the ', label: t.name, type: 'connector' as const, after: ` connector to retrieve ${topic} data.` } },
            { title: 'Preparing the connector query', fieldsLabel: 'Inputs', fields: [{ key: 'Input', value: `"${topic}"` }] },
            { title: 'Executing the connector request', description: t.detail || `The agent sent a request through the ${t.name} connector.`, rawLines: [`POST /api/${t.name.toLowerCase().replace(/\s+/g, '-')}/action`] },
            { title: 'Processing the connector response', description: `Connector responded in ${ms}ms.`, rawLines: [isFailed ? '500 Error' : '200 OK', isFailed ? 'Request failed' : 'Action completed successfully'] },
            { title: 'Generating the final response', description: `Using retrieved data, the agent generated a response for the user.`, fieldsLabel: 'Output', fields: [{ key: 'Output', value: `"${t.name} result"` }] },
            { title: 'Execution summary', description: `${t.name} completed in ${ms}ms, consuming ${tokens} tokens.` },
          ],
          details: { responseTimeMs: ms, tokens },
        };
      }

      case 'skill': {
        const ms = seededNum(seed + 'srt', 280, 760);
        const tokens = seededNum(seed + 'stk', 120, 340);
        return {
          id, type: 'skill', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Matching skill to request', inlinePill: { before: 'The agent matched the ', label: t.name, type: 'topic' as const, after: ' skill to the current user request.' } },
            { title: 'Preparing skill inputs', fieldsLabel: 'Inputs', fields: [{ key: 'query', value: `"${query.length > 60 ? query.slice(0, 60) + '…' : query}"` }] },
            { title: `Executing ${t.name}`, description: t.detail || `Running the ${t.name} skill to process the request.` },
            { title: 'Skill result', fieldsLabel: 'Output', fields: [{ key: 'result', value: `"${t.name} output"` }] },
            { title: 'Execution summary', description: `${t.name} completed in ${ms}ms, consuming ${tokens} tokens.` },
          ],
          details: { responseTimeMs: ms, tokens },
        };
      }

      case 'flow': {
        const ms = seededNum(seed + 'frt', 500, 2000);
        return {
          id, type: 'flow', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Triggering Power Automate flow', description: `The agent triggered the ${t.name} flow to handle the request.` },
            { title: 'Executing flow steps', description: t.detail || `Running flow logic and any connector actions within the flow.` },
            { title: 'Processing flow output', description: `Flow completed and returned results for the agent to use in its response.` },
            { title: 'Execution summary', description: `${t.name} flow completed in ${ms}ms.` },
          ],
          details: { responseTimeMs: ms },
        };
      }

      case 'prompt': {
        const ctxTokens = seededNum(seed + 'ctx', 900, 2100);
        const resTokens = seededNum(seed + 'res', 280, 680);
        return {
          id, type: 'prompt', name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: 'Assembling conversation context', description: `Collecting retrieved content and conversation history — ${ctxTokens.toLocaleString()} tokens assembled.` },
            { title: 'Constructing synthesis prompt', description: 'Combining retrieved information with instructions to build a grounded synthesis prompt.' },
            { title: 'Generating response with grounding', description: t.detail || `Generating response using retrieved sources.` },
            { title: 'Verifying citations and formatting', description: `Response verified and formatted. ${resTokens.toLocaleString()} tokens generated.` },
          ],
          details: { responseTimeMs: seededNum(seed + 'prt', 750, 1900), tokens: ctxTokens + resTokens },
        };
      }

      default: {
        const ms = seededNum(seed + 'drt', 200, 800);
        return {
          id, type: t.type, name: t.name, status: 'rest' as const, errorTitle, error: errorMsg,
          steps: [
            { title: `Executing ${t.name}`, description: t.detail || `The agent invoked ${t.name} to handle the request.` },
            { title: 'Execution summary', description: `${t.name} completed in ${ms}ms.` },
          ],
          details: { responseTimeMs: ms },
        };
      }
    }
  });
}
