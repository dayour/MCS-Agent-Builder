import { AgentConfig, Message } from '../types';
import { callModel } from './modelClient';
import { LLMTraceNode, DANodeType } from '../domains/agent/utils/daCoTGenerator';
import { buildTier1Instructions } from '../domains/dw/utils/dwGlobalInstructions';

/**
 * Run the actual agent using Claude API with agent's configuration.
 * The LLM outputs a <copilot_trace> JSON block before its response, which
 * we parse into real Copilot Studio node data for the CoT visualization.
 */
export const runAgent = async (
  userMessage: string,
  agentConfig: AgentConfig,
  conversationHistory: Message[] = [],
): Promise<{ content: string; reasoning: string; trace: LLMTraceNode[] | null }> => {

  const systemPrompt = buildAgentSystemPrompt(agentConfig);

  try {
    const raw = await callModel({
      model: getModelString(agentConfig.model),
      maxTokens: 4096,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ],
    });

    const { content, trace } = parseTraceFromResponse(raw);

    return {
      content,
      reasoning: `Agent "${agentConfig.name}" processed the request using ${agentConfig.model}`,
      trace,
    };
  } catch (error) {
    console.error('Error calling Claude API for agent preview:', error);
    return {
      content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
      reasoning: 'API error occurred',
      trace: null,
    };
  }
};

// ─── Trace parsing ─────────────────────────────────────────────────────────────

const VALID_NODE_TYPES = new Set<DANodeType>([
  'topic', 'knowledge', 'connector', 'skill', 'flow', 'agent', 'prompt', 'tool',
]);

/**
 * Extract <copilot_trace>...</copilot_trace> from the raw LLM output.
 * Returns the trace nodes (if valid) and the cleaned response content.
 */
function parseTraceFromResponse(raw: string): { content: string; trace: LLMTraceNode[] | null } {
  const traceMatch = raw.match(/<copilot_trace>([\s\S]*?)<\/copilot_trace>/);
  const content = raw.replace(/<copilot_trace>[\s\S]*?<\/copilot_trace>/, '').trim();

  if (!traceMatch) return { content, trace: null };

  try {
    const parsed = JSON.parse(traceMatch[1].trim());
    const nodes: LLMTraceNode[] = (parsed.nodes ?? [])
      .filter((n: unknown) => {
        if (!n || typeof n !== 'object') return false;
        const node = n as Record<string, unknown>;
        return typeof node.type === 'string' && VALID_NODE_TYPES.has(node.type as DANodeType) &&
               typeof node.name === 'string';
      })
      .map((n: Record<string, unknown>) => ({
        type: n.type as DANodeType,
        name: n.name as string,
        outcome: (n.outcome === 'failed' || n.outcome === 'limited') ? n.outcome : 'success',
        detail: typeof n.detail === 'string' ? n.detail : '',
        sources: Array.isArray(n.sources) ? (n.sources as unknown[]).filter(s => typeof s === 'string') as string[] : undefined,
      }));

    return { content, trace: nodes.length > 0 ? nodes : null };
  } catch {
    return { content, trace: null };
  }
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildAgentSystemPrompt(agentConfig: AgentConfig): string {
  const parts: string[] = [];

  if (agentConfig.agentType === 'DW') parts.push(buildTier1Instructions());

  if (agentConfig.name) parts.push(`You are ${agentConfig.name}.`);
  if (agentConfig.description) parts.push(`\n${agentConfig.description}`);
  if (agentConfig.purpose) parts.push(`\n## Purpose\n${agentConfig.purpose}`);
  if (agentConfig.instructions) parts.push(`\n## Instructions\n${agentConfig.instructions}`);

  const knowledgeInfo: string[] = [];
  if (agentConfig.knowledge.webSearch) knowledgeInfo.push('- Web search (general knowledge)');
  if (agentConfig.knowledge.files.length > 0) knowledgeInfo.push(`- ${agentConfig.knowledge.files.length} uploaded knowledge file(s): ${agentConfig.knowledge.files.map(f => f.name).join(', ')}`);
  if (agentConfig.knowledge.referenceOrgChart) knowledgeInfo.push('- Organization chart');
  if (agentConfig.knowledge.specificSources) knowledgeInfo.push('- SharePoint library');
  agentConfig.capabilities?.filter(c => c.type === 'knowledge').forEach(c => knowledgeInfo.push(`- ${c.name}`));
  if (knowledgeInfo.length > 0) parts.push(`\n## Available Knowledge\n${knowledgeInfo.join('\n')}`);

  if (agentConfig.skills?.length) parts.push(`\n## Skills\n${agentConfig.skills.map(s => `- ${s}`).join('\n')}`);
  if (!agentConfig.instructions && !agentConfig.purpose) parts.push('\nYou are a helpful AI assistant.');

  // Build capabilities context for trace generation
  const actionCaps = agentConfig.capabilities?.filter(c => c.type === 'action' || c.type === 'connector') ?? [];
  const apiCaps = agentConfig.knowledge?.customAPIs?.filter(a => a.enabled) ?? [];

  const capLines: string[] = [];
  if (knowledgeInfo.length) capLines.push(`Knowledge sources: ${[...knowledgeInfo].join('; ')}`);
  if (actionCaps.length) capLines.push(`Connectors/actions: ${actionCaps.map(c => c.name).join(', ')}`);
  if (apiCaps.length) capLines.push(`APIs: ${apiCaps.map(a => a.name).join(', ')}`);
  if (agentConfig.skills?.length) capLines.push(`Skills: ${agentConfig.skills.join(', ')}`);
  const capContext = capLines.length ? capLines.join('\n') : 'No external connectors or knowledge sources configured.';

  parts.push(`
## Output format (required)
You are running in a simulation environment.

Output two things in this exact order:

**1. Execution trace** — a compact JSON object inside <copilot_trace> tags describing which Copilot Studio components handled this request:
<copilot_trace>
{"nodes":[{"type":"<type>","name":"<display name>","outcome":"success|limited|failed","detail":"<one sentence>","sources":["<source name>"]}]}
</copilot_trace>

Node types (use exactly as written):
- "topic" — a configured dialog topic that matched the user's intent and ran its internal flow. ONLY use this if the agent has an explicit named topic/dialog (e.g. from its guidelines or skills) that directly maps to this request. Do NOT use for general intent routing or knowledge queries.
- "knowledge" — knowledge search with Generative Answers. This handles both retrieval AND synthesis — it is the only node needed for knowledge-based responses. Use this whenever the agent searches configured knowledge sources to answer a question.
- "connector" — a Power Platform connector action or custom API call
- "skill" — a plugin or extended skill invocation
- "flow" — a Power Automate flow execution

Agent resources available for trace:
${capContext}

Rules:
- Only include nodes actually needed for this specific request
- For knowledge-based agents with no explicit dialog topics, start directly with "knowledge" — no "topic" node
- "sources" field only on "knowledge" nodes; list the actual source names searched
- "outcome": "success" if fulfilled, "limited" if partial, "failed" if you genuinely could not complete it
- Between 1 and 4 nodes
- Keep the JSON on one line

**2. Your response** — the final message to the user. No tool notation, step labels, simulated results, or meta-commentary.`);

  return parts.join('\n');
}

// ─── Model resolution ──────────────────────────────────────────────────────────

function getModelString(model: AgentConfig['model']): string {
  switch (model) {
    case 'opus-4.5': return 'capable';
    case 'sonnet-4.5': return 'balanced';
    case 'haiku-4.5': return 'fast';
    case 'gpt-5.2-auto': return 'gpt-5.2-auto';
    case 'gpt-5.2-instant': return 'gpt-5.2-instant';
    case 'gpt-5.2-thinking': return 'gpt-5.2-thinking';
    default: return 'balanced';
  }
}
