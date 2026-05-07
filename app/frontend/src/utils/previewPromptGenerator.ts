import { callModel } from './modelClient';
import { getAgentStorage, setAgentStorage } from './agentStorage';
import { AgentConfig } from '../types';

export interface PreviewPrompt {
  category: string;
  text: string;
}

const FALLBACK_PROMPTS: PreviewPrompt[] = [
  { category: 'Summarize', text: 'Give me a summary of recent updates' },
  { category: 'Ask', text: 'What can you help me with?' },
  { category: 'Create', text: 'Help me get started' },
  { category: 'Summarize', text: 'What are the key priorities this week?' },
  { category: 'Ask', text: 'What is the current status?' },
  { category: 'Create', text: 'Walk me through the next steps' },
];

interface CachedPrompts {
  fingerprint: string;
  prompts: PreviewPrompt[];
}

/** Build a fingerprint from the config fields that affect prompt relevance */
function buildFingerprint(agentConfig: AgentConfig): string {
  const parts = [
    agentConfig.description,
    agentConfig.purpose,
    agentConfig.instructions?.slice(0, 200),
    agentConfig.guidelines?.join('|'),
    agentConfig.skills?.join('|'),
    agentConfig.capabilities?.map(c => c.name).join('|'),
    agentConfig.knowledge?.files?.length,
    agentConfig.knowledge?.webSearch,
    agentConfig.audience,
    agentConfig.channel,
  ];
  return parts.join('__');
}

/** Generate 6 contextual prompt suggestions for the preview empty state */
export async function generatePreviewPrompts(
  agentConfig: AgentConfig
): Promise<PreviewPrompt[]> {
  const fingerprint = buildFingerprint(agentConfig);

  // Return cached prompts if fingerprint still matches
  try {
    const cached = getAgentStorage(agentConfig.id, 'previewPrompts');
    if (cached) {
      const parsed = JSON.parse(cached) as CachedPrompts;
      if (parsed.fingerprint === fingerprint && Array.isArray(parsed.prompts) && parsed.prompts.length === 6) return parsed.prompts;
    }
  } catch {
    // Ignore cache read errors
  }

  // Build context summary for the LLM
  const contextParts: string[] = [];
  if (agentConfig.name) contextParts.push(`Agent name: ${agentConfig.name}`);
  if (agentConfig.description) contextParts.push(`Description: ${agentConfig.description}`);
  if (agentConfig.purpose) contextParts.push(`Purpose: ${agentConfig.purpose}`);
  if (agentConfig.instructions) contextParts.push(`Instructions: ${agentConfig.instructions.slice(0, 400)}`);
  if (agentConfig.guidelines?.length) contextParts.push(`Guidelines: ${agentConfig.guidelines.join(', ')}`);
  if (agentConfig.skills?.length) contextParts.push(`Skills: ${agentConfig.skills.join(', ')}`);
  if (agentConfig.capabilities?.length) contextParts.push(`Capabilities: ${agentConfig.capabilities.map(c => c.name).join(', ')}`);
  if (agentConfig.audience) contextParts.push(`Audience: ${agentConfig.audience}`);
  if (agentConfig.channel) contextParts.push(`Channel: ${agentConfig.channel}`);
  if (agentConfig.knowledge?.webSearch) contextParts.push('Has web search access');
  if (agentConfig.knowledge?.files?.length) contextParts.push(`Has ${agentConfig.knowledge.files.length} knowledge file(s): ${agentConfig.knowledge.files.map(f => f.name).join(', ')}`);

  const systemPrompt = `You generate short, natural-sounding suggestion prompts for an AI agent chat interface.
Each prompt has a category (one of: Ask, Summarize, Create, Analyze, Find, Draft) and a concise prompt text.
Rules:
- Prompts must be specific and relevant to what this agent actually does — not generic
- Each prompt text should be 5–12 words, written as a natural user request
- Use varied categories across the 6 prompts
- Do not use the agent's name in the prompt text
- Output strictly as JSON array: [{"category":"...","text":"..."},...]
- No explanation, no markdown, just the JSON array`;

  const userMessage = `Generate 6 suggestion prompts for this agent:\n\n${contextParts.join('\n')}`;

  try {
    const raw = (await callModel({
      model: 'fast',
      maxTokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })).trim();
    const jsonStr = raw.startsWith('```') ? raw.replace(/```json?\n?/g, '').replace(/```$/g, '').trim() : raw;
    const prompts = JSON.parse(jsonStr) as PreviewPrompt[];

    if (Array.isArray(prompts) && prompts.length >= 3) {
      const result = prompts.slice(0, 6);
      // Cache the result
      try { setAgentStorage(agentConfig.id, 'previewPrompts', JSON.stringify({ fingerprint, prompts: result })); } catch { /* ignore */ }
      return result;
    }
  } catch (err) {
    console.warn('Failed to generate preview prompts, using fallback:', err);
  }

  return FALLBACK_PROMPTS;
}
