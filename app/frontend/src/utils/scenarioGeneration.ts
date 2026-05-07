import { AgentConfig } from '../types';
import { callModel } from './modelClient';
import { setAgentStorage } from './agentStorage';

export type TriggerType = 'chat' | 'recurrence' | 'form' | 'webhook' | 'record';

export interface StoryField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  value: string;
  options?: string[];
  placeholder?: string;
}

export interface AgentScenario {
  id: string;
  title: string;
  description: string;
  /** Why this scenario was chosen — explains the coverage dimension to the maker. */
  coverageReason?: string;
  triggerType: TriggerType;
  triggerLabel: string;
  storyFields: StoryField[];
  expectedActions: string[];
  isCustom?: boolean;
  lastRunAt?: number;
  lastRunStatus?: 'pass' | 'partial' | 'fail';
  lastRunScore?: string;
  runState?: 'idle' | 'running' | 'complete';
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// Keyed by a fingerprint of the agent's config. Expires after 10 minutes so
// that config edits during a session produce fresh scenarios.

const scenarioCache = new Map<string, { scenarios: AgentScenario[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(config: AgentConfig): string {
  const caps = (config.capabilities || []).map(c => `${c.type}:${c.name}`).sort().join('|');
  return `${config.id}::${(config.instructions || '').slice(0, 400)}::${caps}`;
}

// ─── Difficult-user scenario (deterministic, no LLM needed) ──────────────────

function getDifficultUserScenario(config: AgentConfig): AgentScenario {
  const firstActionCap = (config.capabilities || []).find(c => c.type === 'action');
  // Convert internal action names like "ServiceNow - Create Record" into natural user
  // language like "create a ticket". A real user would never say the connector name.
  const naturalAction = firstActionCap
    ? firstActionCap.name
        .replace(/^.*?\s*-\s*/, '')       // strip "ServiceNow - " prefix
        .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → spaced
        .toLowerCase()
    : '';
  return {
    id: 'difficult-user',
    title: 'Someone is frustrated and pushing back',
    description: `A user who's run out of patience asks ${config.name} for help — but in a way that's outside what the agent can do. Does the agent stay calm and useful?`,
    triggerType: 'chat',
    triggerLabel: 'A frustrated user sends a message',
    storyFields: [
      {
        key: 'message',
        label: 'What does the frustrated user say?',
        type: 'textarea',
        value: naturalAction
          ? `I've been waiting on this for days and I'm done being patient. Just ${naturalAction} for me right now — I don't want to go through all your steps and questions. Other people can do this instantly, why can't you?`
          : `I'm so frustrated right now. I've asked for help multiple times and nothing is working. Stop asking me questions and just give me the answer. This is a complete waste of my time.`,
        placeholder: 'Write what the frustrated user says…',
      },
    ],
    expectedActions: [
      'Acknowledge the user\'s frustration with empathy and without being defensive',
      'Hold firm on configured constraints without dismissing the user',
      'Offer a realistic alternative or clear next step within scope',
    ],
    coverageReason: `Checks tone, boundary enforcement, and graceful recovery when a user pushes back or goes out of scope.`,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateScenarios(agentConfig: AgentConfig, exclude?: string[]): Promise<AgentScenario[]> {
  const key = cacheKey(agentConfig);

  // Skip cache when regenerating with exclusions so we always get fresh results
  if (!exclude) {
    const cached = scenarioCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.scenarios;
    }
  }

  const triggerCaps   = (agentConfig.capabilities || []).filter(c => c.type === 'trigger');
  const actionCaps    = (agentConfig.capabilities || []).filter(c => c.type === 'action');
  const knowledgeCaps = (agentConfig.capabilities || []).filter(c => c.type === 'knowledge');

  const triggerList   = triggerCaps.map(c => c.name).join(', ') || 'Chat messages';
  const actionList    = actionCaps.map(c => c.source ? `${c.name} (${c.source})` : c.name).join(', ') || 'Generate responses';
  const knowledgeList = knowledgeCaps.map(c => c.name).join(', ') || 'None configured';

  const instructions = agentConfig.instructions || agentConfig.purpose || agentConfig.description || '';

  const exclusionClause = exclude && exclude.length > 0
    ? `\nDo NOT generate scenarios similar to any of these already-covered situations — come up with completely different ones:\n${exclude.map(t => `- ${t}`).join('\n')}\n`
    : '';

  const prompt = `You are writing test scenarios for an AI agent. Each scenario describes a realistic situation a real user might find themselves in — something they need to get done — not a technical test of a feature.

Agent name: ${agentConfig.name}
Agent purpose: ${agentConfig.purpose || agentConfig.description}

=== FULL AGENT INSTRUCTIONS ===
${instructions}
=== END INSTRUCTIONS ===

Available triggers: ${triggerList}
Available actions: ${actionList}
Knowledge sources: ${knowledgeList}
${exclusionClause}
How many to generate:
- Look at the different jobs the agent can do for users (each bullet point or distinct task counts)
- Write one scenario per distinct job — do not group or collapse them
- Minimum 2, maximum 4 (a 5th scenario will be added separately)

Return a JSON array. Each item must have:
{
  "title": "Short phrase describing what the user is trying to get done — written from their perspective, not the agent's. 5–8 words. No jargon.",
  "description": "One plain-English sentence describing the situation. What's happening for the user and what do they need? No technical language, no invented names or companies.",
  "coverageReason": "One tight sentence describing what this scenario tests — written for the agent maker, not the end user. Start with an active verb (Checks / Validates / Exercises / Confirms / Tests). List 2–3 specific behaviors being exercised. Optional: add a 'without X' or 'at the right moment' qualifier. No filler, no narrative, no mention of 'your agent' or 'coverage'. 10–15 words max. Examples: 'Checks tone, boundaries, and recovery when a user applies pressure.' / 'Validates policy lookup, reasoning across sources, and correct escalation.' / 'Exercises multi-turn troubleshooting without jumping to escalation.' / 'Confirms the agent escalates at the right moment and takes the right action.'",
  "triggerType": "chat|recurrence|form|webhook|record",
  "triggerLabel": "What kicks this off, in plain English (e.g. 'Someone sends a message asking for help')",
  "storyFields": [
    { "key": "message", "label": "What does the user say?", "type": "textarea", "value": "The actual message the user would type — written as a natural, casual message like someone would send in Teams chat" },
    { "key": "unique_key", "label": "A natural question you'd ask the user to fill in the details (not technical)", "type": "text|select|textarea", "value": "A realistic but generic example value", "options": ["A","B"] }
  ],
  "expectedActions": ["What the agent should actually do — specific action or knowledge source from the instructions"]
}

Rules:
- CRITICAL: For chat triggers, the FIRST story field MUST have key "message" and type "textarea". Its value must be a natural, conversational message — what a real person would actually type in a Teams chat. Good: "Hey, my VPN keeps dropping every few minutes and I can't get any work done. Can you help?" Bad: "Connection timeout error on VPN". Write it casually, in first person, like a real employee asking for help.
- Write titles and descriptions from the user's point of view, not the agent's. Good: "Get a summary of last week's activity". Bad: "Test scheduled report generation capability".
- Story field labels should feel like natural questions, not form field names. Good: "What does the user need help with?". Bad: "Input message".
- No invented names, people, or companies anywhere
- NEVER use internal connector or action names (like "ServiceNow - Create Record" or "Post message in a chat or channel") in user messages — real users don't know these names. Write what a person would naturally say instead (e.g. "file a ticket for me" or "let the team know").
- 2–4 story fields per scenario (including the message field), 2–4 expected actions per scenario
- Each scenario covers a different job — no duplicates

Return ONLY the JSON array, no explanation.`;

  try {
    const raw = await callModel({
      model: 'fast',
      maxTokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array');
    const parsed: any[] = JSON.parse(match[0]);
    const llmScenarios = parsed.slice(0, 4).map((s, i) => ({ ...s, id: `gen-${i}-${Date.now()}` }));
    const scenarios = [...llmScenarios, getDifficultUserScenario(agentConfig)];
    if (!exclude) scenarioCache.set(key, { scenarios, ts: Date.now() });
    return scenarios;
  } catch {
    const scenarios = [...getFallbackScenarios(agentConfig), getDifficultUserScenario(agentConfig)];
    if (!exclude) scenarioCache.set(key, { scenarios, ts: Date.now() });
    return scenarios;
  }
}

/**
 * Ranks a pool of scenarios and returns the top `limit` that maximise coverage
 * and diversity. Scoring dimensions:
 *   - Adversarial / edge-case scenario (difficult-user) → always included first
 *   - Exercises agent knowledge retrieval (if agent has knowledge caps)
 *   - Exercises an agent action (if agent has action caps)
 *   - Novel trigger type not yet represented in the selected set
 *   - More expected actions = higher confidence in thoroughness
 *
 * The result gives makers maximum confidence that they've tested enough of the
 * agent's behaviour before publishing.
 */
export function prioritizeScenarios(
  scenarios: AgentScenario[],
  agentConfig: AgentConfig,
  limit = 4,
): AgentScenario[] {
  if (scenarios.length <= limit) return scenarios;

  const hasKnowledge = (agentConfig.capabilities || []).some(c => c.type === 'knowledge');
  const hasActions   = (agentConfig.capabilities || []).some(c => c.type === 'action');

  const selected: AgentScenario[] = [];
  const remaining = [...scenarios];

  // Always include the adversarial scenario first — it covers a unique coverage dimension
  const adversarialIdx = remaining.findIndex(s => s.id === 'difficult-user');
  if (adversarialIdx !== -1) {
    selected.push(...remaining.splice(adversarialIdx, 1));
  }

  const selectedTriggerTypes = new Set(selected.map(s => s.triggerType));

  function score(s: AgentScenario): number {
    let pts = 0;
    const actionsText = s.expectedActions.join(' ').toLowerCase();

    // Knowledge coverage — high value if agent has knowledge but not yet tested
    if (hasKnowledge && !selected.some(sel => sel.expectedActions.join(' ').toLowerCase().includes('knowledge') || sel.expectedActions.join(' ').toLowerCase().includes('retriev'))) {
      if (actionsText.includes('knowledge') || actionsText.includes('retriev') || actionsText.includes('look up') || actionsText.includes('find')) pts += 3;
    }

    // Action coverage — high value if agent has actions but not yet exercised
    if (hasActions && !selected.some(sel => sel.expectedActions.join(' ').toLowerCase().match(/creat|updat|send|post|submit|log|file/))) {
      if (actionsText.match(/creat|updat|send|post|submit|log|file/)) pts += 3;
    }

    // Trigger type diversity — prefer types not already in the selected set
    if (!selectedTriggerTypes.has(s.triggerType)) pts += 2;

    // Thoroughness — more expected actions = broader coverage assertion
    pts += Math.min(s.expectedActions.length, 4);

    return pts;
  }

  while (selected.length < limit && remaining.length > 0) {
    // Pick the highest-scoring remaining scenario
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = score(remaining[i]);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    selected.push(picked);
    selectedTriggerTypes.add(picked.triggerType);
  }

  return selected;
}

/**
 * Starts a background generation for the given config so the cache is warm
 * by the time the user explicitly requests scenarios. Safe to call speculatively —
 * it's a no-op if the cache already has a fresh entry.
 */
export function prewarmScenarioCache(agentConfig: AgentConfig): void {
  const key = cacheKey(agentConfig);
  const cached = scenarioCache.get(key);
  if (!cached || Date.now() - cached.ts >= CACHE_TTL_MS) {
    // Fire-and-forget — also persist to agentStorage so TriggerLabPage finds it on mount
    generateScenarios(agentConfig).then(scenarios => {
      const fingerprint = (agentConfig.instructions || '').slice(0, 40);
      try { setAgentStorage(agentConfig.id, 'triggerlab_v7', JSON.stringify({ fingerprint, scenarios })); } catch {}
    });
  }
}

export function getFallbackScenarios(config: AgentConfig): AgentScenario[] {
  return [
    {
      id: 'fallback-1',
      title: 'Someone needs help and reaches out',
      description: `A user isn't sure what ${config.name} can do for them and sends a message to find out.`,
      triggerType: 'chat',
      triggerLabel: 'Someone sends a message',
      storyFields: [{
        key: 'message',
        label: 'What does the user say?',
        type: 'textarea',
        value: `What can you help me with?`,
        placeholder: 'Type a message…',
      }],
      expectedActions: ['Acknowledge the user', 'Explain what it can do', 'Offer next steps'],
    },
    {
      id: 'fallback-2',
      title: 'Get a summary at the start of the day',
      description: "At a set time each day, the agent runs automatically and sends a digest of what matters.",
      triggerType: 'recurrence',
      triggerLabel: 'Scheduled time arrives',
      storyFields: [
        { key: 'frequency', label: 'How often should this run?', type: 'select', value: 'Daily', options: ['Hourly', 'Daily', 'Weekly', 'Monthly'] },
        { key: 'time',      label: 'What time should it run?',  type: 'text',   value: '9:00 AM' },
      ],
      expectedActions: ['Execute the scheduled routine', 'Generate a summary', 'Send notifications'],
    },
  ];
}
