/**
 * Snapshot Content Generator
 *
 * Generates contextually relevant placeholder content for built-in snapshots
 * on first load. Content is cached to agentStorage so it is stable across
 * sessions and not regenerated on subsequent loads.
 *
 * Called from activateSnapshot() when snapshot.generateOnLoad === true.
 */

import type { Dispatch, SetStateAction } from 'react';
import { AgentSnapshot, SnapshotLifecycleStage, Message, Evaluation, EvaluationQuestion, MonitoringData } from '../types';
import { callModel } from './modelClient';
import { getAgentStorage, setAgentStorage } from './agentStorage';

// ─── Context passed in from AgentContext ─────────────────────────────────────

export interface GenerationContext {
  setAgentHelperMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  setAgentPreviewMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  setMonitoringData: (data: MonitoringData) => void;
  setEvaluations: Dispatch<SetStateAction<Evaluation[]>>;
}

// ─── Fallback stubs ──────────────────────────────────────────────────────────

function makeFallbackHelperMessages(snapshot: AgentSnapshot): Message[] {
  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60000);
  return [
    {
      id: `stub-h-1-${snapshot.id}`,
      role: 'user',
      content: `I want to create an agent called "${snapshot.agentConfig.name}".`,
      timestamp: ago(30),
    },
    {
      id: `stub-h-2-${snapshot.id}`,
      role: 'assistant',
      content: `I'll help you build "${snapshot.agentConfig.name}". ${snapshot.agentConfig.description || 'Let\'s get started by setting up the core configuration.'}`,
      timestamp: ago(29),
    },
    {
      id: `stub-h-3-${snapshot.id}`,
      role: 'user',
      content: `Can you suggest some guidelines for it?`,
      timestamp: ago(20),
    },
    {
      id: `stub-h-4-${snapshot.id}`,
      role: 'assistant',
      content: `Based on the agent's purpose, here are some suggested guidelines:\n\n${(snapshot.agentConfig.guidelines || []).slice(0, 3).map(g => `- ${g}`).join('\n') || '- Be helpful and concise\n- Escalate when unsure\n- Maintain a professional tone'}`,
      timestamp: ago(19),
    },
  ];
}

function makeFallbackPreviewMessages(snapshot: AgentSnapshot): Message[] {
  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60000);
  return [
    {
      id: `stub-p-1-${snapshot.id}`,
      role: 'user',
      content: 'Hello, can you help me?',
      timestamp: ago(15),
    },
    {
      id: `stub-p-2-${snapshot.id}`,
      role: 'assistant',
      content: `Hi! I'm ${snapshot.agentConfig.name}. ${snapshot.agentConfig.description || 'How can I assist you today?'}`,
      timestamp: ago(14),
    },
  ];
}

function makeFallbackMonitoringData(snapshot: AgentSnapshot): MonitoringData {
  const isPublished = snapshot.agentConfig.published;
  return {
    totalRuns: isPublished ? 248 : 12,
    failedRuns: isPublished ? 3 : 1,
    averageDuration: isPublished ? '1.4s' : '2.1s',
    totalSessions: isPublished ? 180 : 8,
    engagement: isPublished ? 87 : 45,
    themes: [
      { name: 'General inquiries', totalQuestions: isPublished ? 120 : 6, answeredPercentage: isPublished ? 94 : 67, likes: isPublished ? 45 : 2, dislikes: isPublished ? 3 : 1 },
      { name: 'Product questions', totalQuestions: isPublished ? 80 : 4, answeredPercentage: isPublished ? 91 : 50, likes: isPublished ? 30 : 1, dislikes: isPublished ? 2 : 2 },
      { name: 'Process help', totalQuestions: isPublished ? 48 : 2, answeredPercentage: isPublished ? 88 : 50, likes: isPublished ? 18 : 1, dislikes: isPublished ? 4 : 0 },
    ],
  };
}

function makeFallbackEvaluations(snapshot: AgentSnapshot): Evaluation[] {
  const isPublished = snapshot.agentConfig.published;
  const score = isPublished ? 91 : 54;
  const questions: EvaluationQuestion[] = [
    {
      id: `stub-eq-1-${snapshot.id}`,
      question: 'Does the agent respond accurately to common queries?',
      expectedResponse: 'Yes, with specific and correct information.',
      result: isPublished ? 'pass' : 'fail',
      actualResponse: isPublished ? 'Accurate and well-structured response.' : 'Response was vague and incomplete.',
    },
    {
      id: `stub-eq-2-${snapshot.id}`,
      question: 'Does the agent maintain an appropriate tone?',
      expectedResponse: 'Friendly and professional throughout.',
      result: 'pass',
      actualResponse: isPublished ? 'Tone was consistently warm and professional.' : 'Tone was acceptable but inconsistent.',
    },
    {
      id: `stub-eq-3-${snapshot.id}`,
      question: 'Does the agent correctly escalate when needed?',
      expectedResponse: 'Agent escalates complex or out-of-scope requests.',
      result: isPublished ? 'pass' : 'fail',
      actualResponse: isPublished ? 'Correctly identified and escalated edge cases.' : 'Did not escalate when appropriate.',
    },
  ];
  return [
    {
      id: `stub-eval-1-${snapshot.id}`,
      name: isPublished ? 'Production readiness check' : 'Initial quality assessment',
      questions,
      score,
      runDate: new Date(Date.now() - (isPublished ? 2 : 7) * 24 * 3600000),
      duration: isPublished ? '1m 23s' : '2m 05s',
    },
  ];
}

// ─── LLM-based generation helpers ────────────────────────────────────────────

function buildAgentSummary(snapshot: AgentSnapshot): string {
  const cfg = snapshot.agentConfig;
  return `Agent name: ${cfg.name}
Description: ${cfg.description || 'Not set'}
Purpose: ${cfg.purpose || 'Not set'}
Audience: ${cfg.audience || 'Not specified'}
Lifecycle stage: ${snapshot.lifecycleStage}
Instructions (excerpt): ${(cfg.instructions || '').slice(0, 300)}
Guidelines: ${(cfg.guidelines || []).slice(0, 3).join('; ') || 'None'}
Model: ${cfg.model}`;
}

async function generateHelperMessages(agentId: string, snapshot: AgentSnapshot): Promise<Message[]> {
  const agentSummary = buildAgentSummary(snapshot);
  const stageHint: Record<string, string> = {
    'day-zero': 'brand new agent, nothing is configured yet — the conversation should cover initial setup steps',
    'in-progress': 'partially built agent — the conversation should show initial creation and some iteration',
    'published': 'fully configured, published agent — the conversation should show the full development journey including testing and refinement',
    'bad-agent': 'intentionally misconfigured agent — the conversation should show confusion, conflicting requests, and poor decisions',
  };
  const hint = stageHint[snapshot.lifecycleStage] || 'agent in development';

  const prompt = `Generate a realistic Copilot helper conversation showing the creation of this agent at this lifecycle stage (${hint}).

${agentSummary}

Return a JSON array of message objects. Each message has:
- id: string (unique, like "msg-1", "msg-2")
- role: "user" or "assistant"
- content: string (realistic conversation content)
- timestamp: ISO date string (messages spaced a few minutes apart, ending about 5-10 minutes ago)

Include 6-10 messages showing the user building the agent and Copilot helping configure it.
Return ONLY valid JSON — no markdown, no explanation, no wrapper object.`;

  const raw = await callModel({
    model: 'balanced',
    maxTokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  return parsed.map((m: any) => ({
    id: m.id || `gen-h-${Math.random().toString(36).slice(2, 8)}`,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || ''),
    timestamp: new Date(m.timestamp || Date.now()),
  }));
}

async function generatePreviewMessages(agentId: string, snapshot: AgentSnapshot): Promise<Message[]> {
  const agentSummary = buildAgentSummary(snapshot);
  const qualityHint: Record<string, string> = {
    'in-progress': 'rough and partial — the agent makes some mistakes and gives incomplete answers',
    'published': 'polished and professional — the agent handles queries accurately and efficiently',
    'bad-agent': 'confused and unhelpful — the agent contradicts itself and gives poor responses',
    'day-zero': 'minimal — agent barely knows what to do',
  };
  const hint = qualityHint[snapshot.lifecycleStage] || 'moderate quality';

  const prompt = `Generate a realistic test conversation between a user and this AI agent. Response quality should be: ${hint}.

${agentSummary}

Return a JSON array of message objects. Each message has:
- id: string (unique, like "prev-1", "prev-2")
- role: "user" or "assistant"
- content: string (realistic conversation content)
- timestamp: ISO date string (messages spaced 1-2 minutes apart, ending about 3 minutes ago)

Include 4-8 messages showing a realistic test interaction.
Return ONLY valid JSON — no markdown, no explanation, no wrapper object.`;

  const raw = await callModel({
    model: 'balanced',
    maxTokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  return parsed.map((m: any) => ({
    id: m.id || `gen-p-${Math.random().toString(36).slice(2, 8)}`,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || ''),
    timestamp: new Date(m.timestamp || Date.now()),
  }));
}

async function generateMonitoringData(snapshot: AgentSnapshot): Promise<MonitoringData> {
  const agentSummary = buildAgentSummary(snapshot);
  const prompt = `Generate plausible analytics data for this AI agent given its lifecycle stage and domain.

${agentSummary}

Return a JSON object matching this TypeScript interface:
interface MonitoringData {
  totalRuns: number;
  failedRuns: number;
  averageDuration: string; // e.g. "1.4s"
  totalSessions: number;
  engagement: number; // 0-100 percentage
  themes: Array<{
    name: string;
    totalQuestions: number;
    answeredPercentage: number; // 0-100
    likes: number;
    dislikes: number;
  }>;
}

Use realistic numbers appropriate for the lifecycle stage:
- day-zero / bad-agent: low numbers, low quality
- in-progress: moderate numbers
- published: higher numbers, good quality

Return ONLY valid JSON — no markdown, no explanation.`;

  const raw = await callModel({
    model: 'fast',
    maxTokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(jsonStr);
  return parsed as MonitoringData;
}

async function generateEvaluations(snapshot: AgentSnapshot): Promise<Evaluation[]> {
  const agentSummary = buildAgentSummary(snapshot);
  const prompt = `Generate a realistic evaluation run result for this AI agent at its lifecycle stage.

${agentSummary}

Return a JSON array with ONE evaluation object matching this interface:
interface Evaluation {
  id: string;
  name: string;
  questions: Array<{
    id: string;
    question: string;
    expectedResponse: string;
    result: "pass" | "fail";
    actualResponse: string;
  }>;
  score: number; // 0-100
  runDate: string; // ISO date string, a few days ago
  duration: string; // e.g. "1m 23s"
}

Use realistic pass/fail rates:
- published: mostly passing (80-95% score)
- in-progress: mixed (40-65% score)
- bad-agent: mostly failing (10-30% score)

Include 4-6 questions relevant to the agent's domain.
Return ONLY valid JSON — no markdown, no explanation.`;

  const raw = await callModel({
    model: 'balanced',
    maxTokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(jsonStr);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((e: any) => ({
    ...e,
    runDate: e.runDate ? new Date(e.runDate) : new Date(),
  }));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateSnapshotContent(
  agentId: string,
  snapshot: AgentSnapshot,
  context: GenerationContext,
): Promise<void> {
  setAgentStorage(agentId, 'snapshotContentStatus', 'generating');

  const { setAgentHelperMessages, setAgentPreviewMessages, setMonitoringData, setEvaluations } = context;

  // ── Helper messages ──────────────────────────────────────────────────────
  try {
    const existing = getAgentStorage(agentId, 'helperMessages');
    if (!existing) {
      const messages = await generateHelperMessages(agentId, snapshot).catch(() => makeFallbackHelperMessages(snapshot));
      setAgentStorage(agentId, 'helperMessages', JSON.stringify(messages));
      setAgentHelperMessages(prev => ({ ...prev, [agentId]: messages }));
    }
  } catch {
    const fallback = makeFallbackHelperMessages(snapshot);
    setAgentStorage(agentId, 'helperMessages', JSON.stringify(fallback));
    setAgentHelperMessages(prev => ({ ...prev, [agentId]: fallback }));
  }

  // ── Preview messages ─────────────────────────────────────────────────────
  try {
    const existing = getAgentStorage(agentId, 'previewMessages');
    if (!existing) {
      const messages = await generatePreviewMessages(agentId, snapshot).catch(() => makeFallbackPreviewMessages(snapshot));
      setAgentStorage(agentId, 'previewMessages', JSON.stringify(messages));
      setAgentPreviewMessages(prev => ({ ...prev, [agentId]: messages }));
    }
  } catch {
    const fallback = makeFallbackPreviewMessages(snapshot);
    setAgentStorage(agentId, 'previewMessages', JSON.stringify(fallback));
    setAgentPreviewMessages(prev => ({ ...prev, [agentId]: fallback }));
  }

  // ── Monitoring data ──────────────────────────────────────────────────────
  try {
    const existing = getAgentStorage(agentId, 'monitoringData');
    if (!existing) {
      const data = await generateMonitoringData(snapshot).catch(() => makeFallbackMonitoringData(snapshot));
      setAgentStorage(agentId, 'monitoringData', JSON.stringify(data));
      setMonitoringData(data);
    }
  } catch {
    const fallback = makeFallbackMonitoringData(snapshot);
    setAgentStorage(agentId, 'monitoringData', JSON.stringify(fallback));
    setMonitoringData(fallback);
  }

  // ── Evaluations ──────────────────────────────────────────────────────────
  try {
    const existing = getAgentStorage(agentId, 'evaluations');
    if (!existing) {
      const evals = await generateEvaluations(snapshot).catch(() => makeFallbackEvaluations(snapshot));
      setAgentStorage(agentId, 'evaluations', JSON.stringify(evals));
      setEvaluations(evals);
    }
  } catch {
    const fallback = makeFallbackEvaluations(snapshot);
    setAgentStorage(agentId, 'evaluations', JSON.stringify(fallback));
    setEvaluations(fallback);
  }

  setAgentStorage(agentId, 'snapshotContentStatus', 'done');
}

// ─── Per-section generation (used by SnapshotEditor) ─────────────────────────

type SectionType = 'guidelines' | 'instructions' | 'skills' | 'helperMessages' | 'previewMessages' | 'monitoringData' | 'evaluations';

export async function generateSnapshotSection(
  section: SectionType,
  userPrompt: string,
  agentConfig: AgentSnapshot['agentConfig'],
  lifecycleStage: SnapshotLifecycleStage,
): Promise<any> {
  const ctx = buildAgentSummary({ agentConfig, lifecycleStage } as AgentSnapshot);
  const instruction = userPrompt.trim() ? `\n\nAdditional instruction: ${userPrompt}` : '';

  switch (section) {
    case 'guidelines': {
      const raw = await callModel({
        model: 'balanced',
        maxTokens: 600,
        messages: [{ role: 'user', content: `Generate 5-8 concise behavior guidelines for this AI agent. Each guideline is a short, actionable statement.\n\n${ctx}${instruction}\n\nReturn a JSON array of strings — no markdown, no explanation.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      return JSON.parse(clean) as string[];
    }
    case 'skills': {
      const raw = await callModel({
        model: 'fast',
        maxTokens: 400,
        messages: [{ role: 'user', content: `Generate 4-6 skill names for this AI agent. Each is a short label (2-5 words).\n\n${ctx}${instruction}\n\nReturn a JSON array of strings — no markdown, no explanation.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      return JSON.parse(clean) as string[];
    }
    case 'instructions': {
      return await callModel({
        model: 'balanced',
        maxTokens: 1200,
        messages: [{ role: 'user', content: `Write detailed instructions for this AI agent in markdown format. Include sections for role, tone, key responsibilities, and escalation rules.\n\n${ctx}${instruction}\n\nReturn ONLY the instructions text — no JSON, no explanation.` }],
      });
    }
    case 'helperMessages': {
      const raw = await callModel({
        model: 'balanced',
        maxTokens: 1500,
        messages: [{ role: 'user', content: `Generate a realistic Copilot helper conversation showing the creation of this agent. Include 6-10 messages.\n\n${ctx}${instruction}\n\nReturn a JSON array: [{id, role ("user"|"assistant"), content, timestamp (ISO string)}]. No markdown.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      return (parsed as any[]).map(m => ({
        id: m.id || `gen-h-${Math.random().toString(36).slice(2, 8)}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
        timestamp: new Date(m.timestamp || Date.now()),
      })) as Message[];
    }
    case 'previewMessages': {
      const raw = await callModel({
        model: 'balanced',
        maxTokens: 1200,
        messages: [{ role: 'user', content: `Generate a realistic test conversation between a user and this AI agent. Include 4-8 messages.\n\n${ctx}${instruction}\n\nReturn a JSON array: [{id, role ("user"|"assistant"), content, timestamp (ISO string)}]. No markdown.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      return (parsed as any[]).map(m => ({
        id: m.id || `gen-p-${Math.random().toString(36).slice(2, 8)}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
        timestamp: new Date(m.timestamp || Date.now()),
      })) as Message[];
    }
    case 'monitoringData': {
      const raw = await callModel({
        model: 'fast',
        maxTokens: 500,
        messages: [{ role: 'user', content: `Generate plausible analytics data for this AI agent.\n\n${ctx}${instruction}\n\nReturn JSON matching: {totalRuns:number, failedRuns:number, averageDuration:string, totalSessions:number, engagement:number(0-100), themes:[{name, totalQuestions, answeredPercentage, likes, dislikes}]}. No markdown.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      return JSON.parse(clean) as MonitoringData;
    }
    case 'evaluations': {
      const raw = await callModel({
        model: 'balanced',
        maxTokens: 1000,
        messages: [{ role: 'user', content: `Generate a realistic evaluation run for this AI agent with 4-6 questions.\n\n${ctx}${instruction}\n\nReturn a JSON array with ONE object: [{id, name, score(0-100), runDate(ISO), duration("1m 23s"), questions:[{id, question, expectedResponse, result("pass"|"fail"), actualResponse}]}]. No markdown.` }],
      });
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((e: any) => ({
        ...e,
        runDate: e.runDate ? new Date(e.runDate) : new Date(),
      })) as Evaluation[];
    }
    default:
      throw new Error(`Unknown section: ${section}`);
  }
}

// ─── Full snapshot generation (used by GenerateSnapshotDialog) ───────────────

/**
 * Generates a complete AgentConfig from a plain-text description and lifecycle stage.
 * The caller is responsible for supplying the remaining AgentSnapshot fields (id, name, etc.).
 */
async function generateAgentConfigFromDescription(
  description: string,
  lifecycleStage: SnapshotLifecycleStage,
): Promise<AgentSnapshot['agentConfig']> {
  const modelForStage = (lifecycleStage === 'day-zero' || lifecycleStage === 'bad-agent')
    ? 'haiku-4.5'
    : 'sonnet-4.5';
  const isPublished = lifecycleStage === 'published';

  const prompt = `You are generating the configuration for an AI agent based on a plain-text description.

Description: "${description}"
Lifecycle stage: ${lifecycleStage}

Return a JSON object with EXACTLY these fields:
{
  "name": "short specific agent name (3-5 words)",
  "description": "one sentence describing what the agent does",
  "purpose": "one sentence describing its main goal",
  "audience": "employees" or "customers",
  "guidelines": ["5-7 short actionable behavior guidelines"],
  "instructions": "markdown instructions (~300 chars). Include sections for role, tone, and key responsibilities.",
  "skills": ["3-5 skill names (2-4 words each)"],
  "capabilities": [{"name": "capability name", "type": "knowledge" | "action", "description": "one sentence"}],
  "icon": "single emoji that matches the agent domain",
  "gradientKey": one of: "violet", "rose", "sky", "amber", "emerald", "slate"
}

For capabilities, only include ones that make sense for this agent type (e.g. Order Lookup for e-commerce, Knowledge Base for support, Scheduling Tool for scheduling). Use 0-3 capabilities.
Return ONLY valid JSON — no markdown fences, no extra text.`;

  const raw = await callModel({
    model: 'balanced',
    maxTokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    type: 'agent',
    name: String(parsed.name || 'Untitled Agent'),
    description: String(parsed.description || ''),
    purpose: String(parsed.purpose || ''),
    audience: (['employees', 'customers', 'personal'].includes(parsed.audience) ? parsed.audience : 'employees') as AgentSnapshot['agentConfig']['audience'],
    guidelines: Array.isArray(parsed.guidelines) ? parsed.guidelines.map(String) : [],
    instructions: String(parsed.instructions || ''),
    skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
    capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
    icon: String(parsed.icon || '🤖'),
    gradientKey: String(parsed.gradientKey || 'violet'),
    model: modelForStage as AgentSnapshot['agentConfig']['model'],
    published: isPublished,
    knowledge: {
      files: [],
      webSearch: false,
      specificSources: false,
      referenceOrgChart: false,
      customAPIs: [],
    },
  };
}

export interface GeneratedSnapshotData {
  agentConfig: AgentSnapshot['agentConfig'];
  lifecycleStage: SnapshotLifecycleStage;
  description: string;
  tags: string[];
  helperMessages: Message[];
  previewMessages: Message[];
  monitoringData: MonitoringData;
  evaluations: Evaluation[];
}

/**
 * Generates a complete snapshot from a plain-text description and lifecycle stage.
 * Runs config generation first, then fans out the four content generators in parallel.
 * The caller is responsible for assigning id, name, createdAt, and isBuiltIn.
 */
export async function generateFullSnapshot(
  description: string,
  lifecycleStage: SnapshotLifecycleStage,
): Promise<GeneratedSnapshotData> {
  const agentConfig = await generateAgentConfigFromDescription(description, lifecycleStage);

  const tempId = `gen-${Date.now()}`;
  const partialSnapshot: AgentSnapshot = {
    id: tempId,
    name: agentConfig.name,
    description: agentConfig.description,
    tags: [],
    lifecycleStage,
    agentConfig,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  };

  const [helperMessages, previewMessages, monitoringData, evaluations] = await Promise.all([
    generateHelperMessages(tempId, partialSnapshot).catch(() => makeFallbackHelperMessages(partialSnapshot)),
    generatePreviewMessages(tempId, partialSnapshot).catch(() => makeFallbackPreviewMessages(partialSnapshot)),
    generateMonitoringData(partialSnapshot).catch(() => makeFallbackMonitoringData(partialSnapshot)),
    generateEvaluations(partialSnapshot).catch(() => makeFallbackEvaluations(partialSnapshot)),
  ]);

  return {
    agentConfig,
    lifecycleStage,
    description: agentConfig.description,
    tags: [],
    helperMessages,
    previewMessages,
    monitoringData,
    evaluations,
  };
}

// ─── Notes generation (used by SnapshotEditor) ───────────────────────────────

/**
 * Generates author notes for a snapshot — 2–4 sentences describing the agent's
 * current state so a reader can decide if it suits their purpose.
 * Uses the full snapshot (config + toggles + seeded data) for a complete picture.
 */
export async function generateSnapshotNotes(
  snapshot: AgentSnapshot,
  userPrompt: string,
): Promise<string> {
  const cfg = snapshot.agentConfig;

  // Build a rich summary of everything in the snapshot
  const configSummary = [
    `Agent: ${cfg.name}`,
    cfg.description ? `Description: ${cfg.description}` : null,
    cfg.purpose ? `Purpose: ${cfg.purpose}` : null,
    cfg.audience ? `Audience: ${cfg.audience}` : null,
    `Model: ${cfg.model}`,
    `Lifecycle stage: ${snapshot.lifecycleStage}`,
    cfg.published ? `Published: yes (v${cfg.version || '1.0'})` : `Published: no`,
    cfg.instructions ? `Instructions (excerpt): ${cfg.instructions.slice(0, 400)}` : null,
    cfg.guidelines?.length ? `Guidelines (${cfg.guidelines.length}): ${cfg.guidelines.slice(0, 4).join(' | ')}` : null,
    cfg.skills?.length ? `Skills: ${cfg.skills.slice(0, 5).join(', ')}` : null,
    cfg.capabilities?.length ? `Capabilities: ${cfg.capabilities.map((c: any) => c.name).join(', ')}` : null,
    cfg.knowledge?.webSearch ? `Web search: enabled` : null,
  ].filter(Boolean).join('\n');

  // Summarise interesting (non-false) toggle state
  const activeToggles = Object.entries(snapshot.toggleState ?? {})
    .filter(([, v]) => v !== false && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  const toggleSummary = activeToggles.length
    ? `Toggle state: ${activeToggles.join(', ')}`
    : 'Toggle state: default (no overrides)';

  // Summarise seeded data
  const dataParts = [
    snapshot.helperMessages?.length ? `${snapshot.helperMessages.length} helper messages` : null,
    snapshot.previewMessages?.length ? `${snapshot.previewMessages.length} preview messages` : null,
    snapshot.evaluations?.length
      ? `${snapshot.evaluations.length} evaluation(s), top score ${Math.max(...snapshot.evaluations.map(e => e.score ?? 0))}`
      : null,
    snapshot.monitoringData
      ? `monitoring data (${snapshot.monitoringData.totalRuns} runs, ${snapshot.monitoringData.engagement}% engagement)`
      : null,
  ].filter(Boolean);
  const dataSummary = dataParts.length ? `Seeded data: ${dataParts.join('; ')}` : 'No seeded data';

  const instruction = userPrompt.trim() ? `\n\nAdditional guidance: ${userPrompt}` : '';

  const prompt = `You are writing author notes for an AI agent snapshot. Write 2–4 sentences that describe the agent's current state and help a reader decide if this snapshot is useful for their purpose. Cover what the agent does, how complete its configuration is, what data is seeded, and any notable toggle requirements. Be concise and specific — avoid vague phrases like "well-configured" without evidence.

${configSummary}
${toggleSummary}
${dataSummary}${instruction}

Return ONLY the notes text — no JSON, no heading, no bullet points.`;

  return await callModel({
    model: 'balanced',
    maxTokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
}
