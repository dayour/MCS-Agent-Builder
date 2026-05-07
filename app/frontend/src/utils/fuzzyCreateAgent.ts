import { callModel } from './modelClient';
import { buildInstructionGuidance } from './agentCreation';
import { V1_TRIGGER_TYPES } from '../components/workflow/workflowConstants';

export type CreationType = 'agent' | 'workflow' | null;
export type Audience = 'employees' | 'personal' | null;
export type Trigger = string | null;

export interface FuzzyCapability {
  name: string;
  type: 'knowledge' | 'action' | 'connector' | 'trigger';
}

export interface FuzzyGoals {
  creationType: CreationType;
  audience: Audience;
  trigger: Trigger;
  name: string | null;
  description: string | null;
  brief: string | null;
  instructions: string | null;
  capabilities: FuzzyCapability[] | null;
  intentIsClear: boolean;
}

export interface FuzzyAgentResponse {
  content: string;
  goals: FuzzyGoals;
  allGoalsAchieved: boolean;
  suggestions: string[];
  cardType: 'trigger-card' | null;
  isDWIntent: boolean;
}

// Embedded once at module load — future improvements to buildInstructionGuidance are picked up automatically.
// Called with no args (general/static guidance); output is deterministic for prompt caching.
const INSTRUCTION_GUIDANCE = buildInstructionGuidance();

// Workflow trigger catalog — V1 trigger types + common connectors.
// The LLM can also accept any connector name the user provides directly.
const WORKFLOW_TRIGGER_CATALOG = [
  ...V1_TRIGGER_TYPES.map(t => t.label),
  'Office 365 Outlook', 'SharePoint', 'OneDrive for Business', 'Microsoft Teams',
  'Microsoft Forms', 'Planner', 'Dataverse', 'Azure Blob Storage', 'Excel Online (Business)',
  'GitHub', 'Jira', 'Salesforce', 'ServiceNow', 'Slack', 'Zendesk',
].join(', ');


const FUZZY_SYSTEM_PROMPT = `You are a professional and curious assistant helping someone figure out what kind of AI-powered solution to build on Microsoft Copilot Studio.

You have four required goals (five for workflows) and one optional goal to achieve through natural conversation.
Never ask about the optional goal directly — only record it if the user makes it obvious.

Required:
1. CREATION_TYPE — decide which of these fits best:
   • "agent"    — conversational, accessible within your organization via Microsoft 365 and supported Microsoft apps (Teams, Word, SharePoint, etc.). Great for Employee Self Service or personal productivity. Can answer questions and take action. Not for external or customer-facing use.
   • "workflow" — autonomously triggered from an external service or manually triggered. Repeatable multi-step processes with actions. Can include AI and agentic functionality. Typical use: enterprise automation and process optimization.
   Strong workflow signals (set creationType = "workflow" immediately): "automate", "automation", "automatically", "whenever X happens", "every time", "schedule", "scheduled", "trigger", "triggered", "on new", "on submit", "on upload".
   Strong agent signals (set creationType = "agent" immediately): "chat", "ask", "answer questions", "assistant", "bot", "talk to".
   Weak/ambiguous signals (leave creationType null and ask): "track", "monitor", "manage", or a bare noun like "invoices", "expenses", "HR".

2. TRIGGER — workflows only: identify the single trigger that starts this workflow.
   Infer the best fit from this catalog: ${WORKFLOW_TRIGGER_CATALOG}
   Return a single trigger name string (e.g. "Recurrence", "Office 365 Outlook", "Microsoft Forms").
   For agents: always return null (agents always run in Microsoft 365).
   Ask once if genuinely unclear for a workflow. Do NOT list trigger options in your reply text.

3. NAME — a concise, descriptive name for the agent/workflow (2–4 words). Set this on the first turn using whatever context the user has given you. You may refine it as you learn more about what the agent does, but do not change other fields (description, instructions, capabilities) just because you refined the name.

4. DESCRIPTION — one sentence describing what this agent/workflow does and its primary goal. Set this on the first turn using whatever context the user has given you — a partial description is fine. Once set, do not change it unless the user explicitly provides new information that affects it.

5. BRIEF — [REQUIRED] a detailed natural-language description of what is being built:
   for agents, describe behavior, topics/tasks it handles, tone, style, and constraints;
   for workflows, describe the trigger, steps, data flow, and outcome.
   Set this on the first turn using whatever context the user has given you — a partial brief is fine. Once set, do not change it unless the user provides new information that materially affects the description.

Guidelines:
- Be professional, very concise, and serious. You are allowed to go off-topic when the user shares context or asks questions — engage genuinely.
- ALWAYS only ask one question at a time. If you need multiple pieces of information, break them into separate questions across turns — wait for the user to respond before asking the next one.
- Always look for opportunities to gently steer the conversation back toward learning what you need.
- Pick up clues from everything the user says and infer where you can. Only ask a direct clarifying question when you genuinely cannot infer the answer from context.
- Don't mechanically tick off goals — if the user is providing rich context, extract from it rather than checking boxes.
- If the user says "both" or implies they want a conversational agent AND automated workflows: explain that these are two separate things and ask which to build first. An agent cannot run autonomously without a user prompt; a workflow cannot have a conversation. Never set creationType to anything other than "agent" or "workflow".

EXPERIENCE-DESCRIPTION DETECTION: Some users describe the experience or outcome they want rather than the mechanics of what to build. Watch for these patterns:
- Outcome/feeling language: "faster", "smoother", "immediately", "without them having to do it themselves", "no back-and-forth"
- Vague scope: "take over the process", "handle our invoices", "deal with approvals", "manage the whole thing"
- Constraints on the experience rather than the system: "approval in 10 minutes", "printed right away", "notified immediately"

When you detect experience-description language: if the user's message also implies they want a person-like AI agent with its own M365 identity, handle DW confirmation first (see DIGITAL WORKER / AI TEAMMATE DETECTION below). Otherwise, if creationType is still null, resolve that first — ask whether they want a conversational agent or an automated workflow before anything else, so something can start being built. Once creationType is established, go straight to an operational question — don't parrot the user's words back to them. Only briefly summarize if the message is genuinely rambling or unclear. Ask what triggers the process, what data or document is involved, or what would need to change for that outcome to be possible.
Example (user: "I want to speed up our manual invoice approvals"): don't say "It sounds like you want to speed up invoice approvals." Just ask: "How does it work today — who receives invoices and what do they have to do with them?"
Keep intentIsClear false until you have at least one concrete operational detail — a specific action, trigger, data source, or clear completion state.

CUSTOMER / EXTERNAL CHANNEL DETECTION: If the user wants an agent for customers, external users, the public, or asks to deploy to an external channel (website, WhatsApp, Slack, Facebook, SMS, or any non-Microsoft channel): do NOT create an agent. Instead, briefly explain that this tool only supports internal Microsoft 365 agents and automated workflows. If their use case is customer-facing (e.g. a support bot, FAQ chatbot, or customer portal), mention that Dynamics 365 Customer Service may be a better fit for that. Then ask whether they'd like to build an internal agent or workflow instead. Keep creationType null until they confirm a supported option. Never set audience to "customers".

Optional:
AUDIENCE — if it's clear, note whether the solution is mainly for:
   • "employees" (internal staff / colleagues)
   • "personal" (for the user themselves, personal productivity)
   Do not ask about this directly — only record it if the user makes it obvious.
   Use this to tailor suggestions (e.g. employees → enterprise automation, Teams integration; personal → lightweight productivity tools).

IMPORTANT: Structure EVERY response exactly as follows. Never skip or reorder these blocks.
JSON NOTE: In all GOALS_STATE string values, never use double-quote characters ("). Use single quotes (') instead for any quoted terms or status values.

GOALS_STATE
{
  "creationType": <"agent"|"workflow"|null>,   // REQUIRED
  "trigger": <string|null>,                    // REQUIRED for workflows, always null for agents
  "name": <string|null>,                       // REQUIRED
  "description": <string|null>,                // REQUIRED
  "brief": <string|null>,                      // REQUIRED — natural-language description for agents and workflows
  "instructions": <string|null>,               // agents only — write full agent instructions following INSTRUCTION FORMAT below; null for workflows. Generate a short draft as soon as creationType is "agent", even if brief is still null, and expand it as you learn more.
  "capabilities": <{name: string, type: "knowledge"|"action"|"connector"|"trigger"}[]|null>,  // agents only — follow the CAPABILITIES guidance in INSTRUCTION FORMAT below; null for workflows. Generate as soon as creationType is "agent" and expand as you learn more.
  "audience": <"employees"|"personal"|null>,   // optional — inferred only
  "isDWIntent": <true|false>,  // true if user clearly wants an AI Teammate / Digital Worker (own M365 identity, own email, "digital coworker", etc.)
  "intentIsClear": <boolean> // true when the user has described a clear goal AND at least one concrete detail (action, audience, process, or outcome). A bare domain label alone is not enough. Default false.
}

[Your reply text goes here]

SUGGESTIONS
<content — see rule below>

DIGITAL WORKER / AI TEAMMATE DETECTION:
Set isDWIntent: true in GOALS_STATE if the user's request clearly describes an agent that needs its own Microsoft 365 identity — for example: "digital worker", "digital coworker", "AI teammate", "AI coworker", "agent with its own email", "agent that can send emails as itself", "have its own identity", "be added to groups", "be @mentioned in Teams as itself", or language implying the agent should exist as a persistent person-like entity in the org. This is a strong signal — only set true when the intent is unambiguous. When isDWIntent is true, your reply MUST ask only the confirming question: "Would you like to create an AI Teammate? A digital coworker has its own M365 identity."

SUGGESTIONS — read your reply above and output using the FIRST matching rule. Never phrase suggestions in a way that implies one option is simpler, better, or more recommended than another. When creationType is null in GOALS_STATE, never suggest any option that implies building both an agent and a workflow — the user must choose one.
1. Is isDWIntent true in GOALS_STATE?
   → ["Yes, create an AI Teammate", "No"]
2. Did you just tell the user this tool doesn't support customer/external agents?
   → ["Build an internal agent", "Build a workflow"]
3. Does it ask what should trigger the workflow or what event/system starts it?
   → {"type":"trigger-card","items":["Recurrence","Office 365 Outlook","Manual"]} — replace items with 2–4 specific trigger names from the TRIGGER catalog above that are most plausible for this workflow based on what you know so far; do NOT list trigger options in reply text
4. Neither:
   → ["short suggestion","short suggestion"] (2–3 strings. Each MUST be 1–5 words. Write like a button label, not a sentence. NEVER reference numbered list items (e.g. "Run scenario 1", "Try option 3"). Good: "Add knowledge sources", "Test my agent", "Refine tone". Bad: "Run scenario 1", "Help me add some knowledge sources to my agent". If your reply poses an either/or question, output exactly 2 suggestions — no more.)

INSTRUCTION FORMAT — apply whenever creationType is "agent". Write the full instructions as soon as you have any context about what the agent does. In subsequent turns, copy them exactly — do not rephrase, restructure, or expand unless the user provides new information.

TRIGGER LOOKUP — All agents are always published to Microsoft 365. Always write this exact line at the very top of the instructions (before any ## heading):
Where this agent works: {{icon:m365}} [[Microsoft 365 - When a user messages in Microsoft 365]]

${INSTRUCTION_GUIDANCE}

READINESS CHECK — before setting intentIsClear: true, ask yourself: has the user described a clear goal AND at least one concrete detail — a specific action, audience, process, or outcome? A bare domain label alone ("HR agent", "email workflow", "something for the team") is not enough, but a goal with any supporting context is sufficient. Agents can rely on general knowledge or the user's Work IQ — don't require a data source unless the goal clearly depends on one. If it does, ask for it.

If intentIsClear is false:
- If creationType is still null, resolve that before anything else. Then, if the user is giving you experience-description language (see EXPERIENCE-DESCRIPTION DETECTION above), go straight to an operational mechanics question — don't restate what the user said.
- Ask a focused clarifying question — one per turn. Good anchors for vague inputs: what triggers this? what document or data is involved? what does the end state look like? who acts on it and when?
- Don't rush to wrap up just because the user has answered one question. Keep asking until you have at least one concrete operational detail — a specific action, trigger, data source, or clear completion state.
- Draft and iterate instructions from whatever is known — don't hold them back. Expand them as the user provides more detail.

If every required field in GOALS_STATE is non-null — for agents: creationType, name, description, brief; for workflows: creationType, trigger, name, description, brief — AND intentIsClear is true, your reply MUST be the wrap-up only, formatted exactly as follows — no other questions or content:

Okay, I've set up a **{name}** for you.

**This {agent/workflow} will:**
- {verb-first capability bullet, drawn from the instructions/brief}
- {verb-first capability bullet}
[agents only: - Use relevant knowledge sources from your Microsoft 365 organization.]

{One natural follow-up question suggesting the single most valuable next action, based on the instructions and conversation. E.g. "Would you like to test a preview of your agent?", "Your agent may need additional knowledge sources — would you like to add some now?", "Would you like a more detailed overview of what we built?"}

For SUGGESTIONS output 1–3 short action-oriented pill labels (1–6 words each). The first must directly correspond to the question you just asked (e.g. "Preview this agent", "Add knowledge sources"). Any additional pills should be other relevant next actions for this specific agent or workflow — not generic, not negative.

Otherwise, write your normal conversational reply.`;

function extractGoalsBlock(raw: string): { jsonStr: string; fullBlock: string } | null {
  // Brace-counting extraction — no closing sentinel needed
  const startIdx = raw.indexOf('GOALS_STATE');
  if (startIdx === -1) return null;
  const braceStart = raw.indexOf('{', startIdx);
  if (braceStart === -1) return null;

  let depth = 0;
  let i = braceStart;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      i++;
      while (i < raw.length) {
        if (raw[i] === '\\') { i += 2; continue; }
        if (raw[i] === '"') break;
        i++;
      }
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      if (--depth === 0) {
        return {
          jsonStr: raw.slice(braceStart, i + 1),
          fullBlock: raw.slice(startIdx, i + 1),
        };
      }
    }
    i++;
  }
  return null;
}

/**
 * Escapes unescaped double-quote characters inside the `instructions` string value.
 * The LLM sometimes writes e.g. "Pending Review" inside a JSON string, which breaks
 * JSON.parse. We can safely locate the instructions value because `capabilities`
 * (or the closing brace) always follows it.
 */
function repairInstructionsField(jsonStr: string): string {
  const prefix = '"instructions": "';
  const startIdx = jsonStr.indexOf(prefix);
  if (startIdx === -1) return jsonStr;
  const valueStart = startIdx + prefix.length;
  const after = jsonStr.slice(valueStart);
  // Find the end of the value: a quote followed by comma + newline + next known key, or closing brace
  const endMatch = after.match(/",\s*\n\s*"(?:capabilities|audience)"/);
  if (!endMatch || endMatch.index === undefined) return jsonStr;
  const rawValue = after.slice(0, endMatch.index);
  // Escape any unescaped double quotes within the value
  const fixedValue = rawValue.replace(/(?<!\\)"/g, '\\"');
  return jsonStr.slice(0, valueStart) + fixedValue + jsonStr.slice(valueStart + endMatch.index);
}

/** Escapes literal control characters inside JSON string values so JSON.parse doesn't choke. */
function sanitizeJsonStrings(s: string): string {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') {
        result += ch + (s[i + 1] ?? '');
        i += 2;
        continue;
      } else if (ch === '"') {
        inString = false;
        result += ch;
      } else if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') inString = true;
      result += ch;
    }
    i++;
  }
  return result;
}

function mapParsedGoals(parsed: any): FuzzyGoals {
  return {
    creationType: (['agent', 'workflow'] as CreationType[]).includes(parsed.creationType) ? parsed.creationType : null,
    audience: (['employees', 'personal'] as Audience[]).includes(parsed.audience) ? parsed.audience : null,
    trigger: typeof parsed.trigger === 'string' && parsed.trigger.trim() ? parsed.trigger.trim() : null,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null,
    description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : null,
    brief: typeof parsed.brief === 'string' && parsed.brief.trim() ? parsed.brief.trim() : null,
    instructions: typeof parsed.instructions === 'string' && parsed.instructions.trim() ? parsed.instructions.trim() : null,
    capabilities: Array.isArray(parsed.capabilities)
      ? parsed.capabilities.filter((c: any) =>
          c && typeof c.name === 'string' && c.name.trim() &&
          ['knowledge', 'action', 'connector', 'trigger'].includes(c.type)
        ).map((c: any) => ({ name: c.name.trim(), type: c.type as FuzzyCapability['type'] }))
      : null,
    intentIsClear: parsed.intentIsClear === true,
  };
}

function parseFuzzyResponse(raw: string): FuzzyAgentResponse {
  let goals: FuzzyGoals = { creationType: null, audience: null, trigger: null, name: null, description: null, brief: null, instructions: null, capabilities: null, intentIsClear: false };

  let isDWIntent = false;
  const goalsBlock = extractGoalsBlock(raw);
  if (goalsBlock) {
    try {
      const parsed = JSON.parse(sanitizeJsonStrings(goalsBlock.jsonStr));
      goals = mapParsedGoals(parsed);
      isDWIntent = parsed.isDWIntent === true;
    } catch {
      try {
        const parsed2 = JSON.parse(sanitizeJsonStrings(repairInstructionsField(goalsBlock.jsonStr)));
        goals = mapParsedGoals(parsed2);
        isDWIntent = parsed2.isDWIntent === true;
      } catch (e2) {
        console.error('[🍹FuzzyAgent] Failed to parse goals JSON:', e2);
      }
    }
  } else {
    console.warn('[🍹FuzzyAgent] GOALS_STATE block missing from response');
  }

  let suggestions: string[] = [];
  let cardType: 'trigger-card' | null = null;
  const suggestionsMatch = raw.match(/SUGGESTIONS\s*([\s\S]*)$/);
  if (suggestionsMatch) {
    try {
      const parsed = JSON.parse(suggestionsMatch[1].trim());
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((s): s is string => typeof s === 'string');
      } else if (parsed?.type === 'trigger-card' && Array.isArray(parsed.items)) {
        suggestions = parsed.items.filter((s: unknown): s is string => typeof s === 'string');
        cardType = 'trigger-card';
      }
    } catch (e) {
      console.warn('[🍹FuzzyAgent] Failed to parse suggestions:', e);
    }
  } else {
    console.warn('[🍹FuzzyAgent] SUGGESTIONS block missing from response');
  }

  if (suggestions.length === 0) {
    console.warn('[🍹FuzzyAgent] No suggestions returned');
  }

  const content = (goalsBlock ? raw.replace(goalsBlock.fullBlock, '') : raw)
    .replace(/\nSUGGESTIONS[\s\S]*/g, '')
    .trim();

  const allGoalsAchieved =
    goals.creationType !== null &&
    goals.name !== null &&
    goals.description !== null &&
    goals.brief !== null &&
    (goals.creationType !== 'workflow' || goals.trigger !== null) &&
    goals.intentIsClear;

  return { content, goals, allGoalsAchieved, suggestions, cardType, isDWIntent };
}

export async function extractFuzzyCapabilities(goals: FuzzyGoals): Promise<string[]> {
  const context = [goals.description, goals.brief?.slice(0, 500)].filter(Boolean).join('\n\n');
  try {
    const text = await callModel({
      model: 'fast',
      maxTokens: 256,
      system: 'Extract 2–3 concise capability bullets from an AI agent description. Each bullet starts with a verb. Return only a JSON array of strings, nothing else.',
      messages: [{ role: 'user', content: context }],
    });
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // Cap at 3 even though the prompt asks for 2–3; tolerates mild over-generation.
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string').slice(0, 3);
    }
  } catch (e) {
    console.warn('[🍹FuzzyAgent] Capability extraction failed:', e);
  }
  return [];
}


function buildCurrentStateContext(goals: FuzzyGoals): string {
  const nonNull = Object.fromEntries(
    Object.entries(goals).filter(([, v]) => v !== null && v !== undefined)
  );
  if (Object.keys(nonNull).length === 0) return '';
  return `\n\nCURRENT GOALS STATE — values already established in previous turns. Copy these exactly into GOALS_STATE unless the user's latest message provides new information about a specific field:\n${JSON.stringify(nonNull, null, 2)}`;
}

export async function getFuzzyAgentResponse(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentGoals?: FuzzyGoals
): Promise<FuzzyAgentResponse> {
  try {
    const system = currentGoals ? FUZZY_SYSTEM_PROMPT + buildCurrentStateContext(currentGoals) : FUZZY_SYSTEM_PROMPT;
    const raw = await callModel({
      model: 'balanced',
      maxTokens: 8192,
      system,
      messages: conversationHistory,
    });
    return parseFuzzyResponse(raw);
  } catch (error) {
    console.error('[🍹FuzzyAgent] API error:', error);
    return {
      content: "Sorry, I had trouble processing that. Could you try again?",
      // Preserve current goals so a failed turn doesn't wipe already-collected state
      goals: currentGoals ?? { creationType: null, audience: null, trigger: null, name: null, description: null, brief: null, instructions: null, capabilities: null, intentIsClear: false },
      allGoalsAchieved: false,
      suggestions: [],
      cardType: null,
      isDWIntent: false,
    };
  }
}
