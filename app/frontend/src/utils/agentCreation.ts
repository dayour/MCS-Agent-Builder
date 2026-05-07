import { callModel } from './modelClient';
import { KNOWN_TRIGGERS, KNOWN_TOOLS } from './agentCatalog';

/**
 * Shared agent-writing guidance helper. Originally consumed by
 * generateAgentFromDescription and updateAgentInstructionsFromBrief
 * (both removed in cleanup 2026-05-05); now consumed only by the
 * caller in src/. Covers: audience context, triggers, purpose,
 * capabilities, instruction structure, quality standards.
 */
export const buildInstructionGuidance = (audience?: 'customers' | 'employees' | 'personal' | null, channels?: string[] | null): string => {
  const audienceSection = audience === 'customers'
    ? `AUDIENCE: External Customer-Facing Agent
This agent will interact with CUSTOMERS (external users). Prioritize:
- Brand voice and consistent messaging
- Clear, friendly, accessible language - avoid internal jargon
- Privacy and data protection
- Escalation paths to human support
- Professional boundaries (what to share vs. keep internal)
- Empathy and patience with varied customer knowledge levels
- Clear explanations without assuming domain expertise`
    : audience === 'employees'
    ? `AUDIENCE: Internal Business-to-Employee (B2E) Agent
This agent will interact with EMPLOYEES (internal users). Prioritize:
- Direct, efficient communication
- Internal tools, systems, and terminology
- Company-specific processes and policies
- Integration with internal knowledge bases
- Focus on productivity and task completion
- Can assume familiarity with company context
- Proactive guidance on internal best practices`
    : audience === 'personal'
    ? `AUDIENCE: Personal Assistant Agent
This agent will help YOU (individual user) with personal tasks. Prioritize:
- Personalized, conversational tone
- Learning your preferences and work style
- Direct, efficient communication tailored to you
- Personal productivity and task management
- Integration with your personal tools and workflows
- Focus on helping you work more efficiently
- Proactive suggestions based on your patterns`
    : `AUDIENCE: General Purpose Agent
Create flexible instructions that work well for various audiences.`;

  const communicationNote = audience === 'customers'
    ? ' (focus on empathy, clarity for customers)'
    : audience === 'employees'
    ? ' (focus on efficiency, directness for employees)'
    : audience === 'personal'
    ? ' (focus on personalization, helpfulness for you)'
    : '';

  const audienceDeployment = audience === 'customers'
    ? 'customer-facing deployment'
    : audience === 'employees'
    ? 'internal enterprise deployment'
    : audience === 'personal'
    ? 'personal assistant use'
    : 'enterprise deployment';

  const triggerList = KNOWN_TRIGGERS.join(', ');
  const toolList = KNOWN_TOOLS.join(', ');

  const channelTriggerHints = `Channel-to-trigger hints:
  - "Teams" → "Teams - When a user messages in Teams" | icon key: teams
  - "Microsoft 365" or "M365" → "Microsoft 365 - When a user messages in Microsoft 365" | icon key: m365 (this is a DIFFERENT trigger from Teams — do NOT substitute one for the other)
  - "SharePoint" → "Teams - When a user messages in Teams" (conversational) or a SharePoint trigger if data-driven | icon key: teams or sharepoint
  - "Web" or "WhatsApp" → "Website - When a user messages on Website" or "WhatsApp - When a user messages in WhatsApp" | icon key: website or whatsapp
  - "Outlook" or email use cases → "Outlook - On New Email" | icon key: outlook
  - Scheduled/periodic agents → "Recurrence" | icon key: recurrence
  - Form submissions → "Forms - On New Form Submission" | icon key: forms
  Icon key reference (use service prefix, lowercase, no spaces): teams, m365, website, slack, whatsapp, outlook, sharepoint, onedrive, forms, dataverse, planner, recurrence`;

  const triggerGuidance = !channels || channels.length === 0
    ? `TRIGGERS: No channel has been selected yet. Based on the agent's purpose and audience, choose the SINGLE most appropriate trigger from the list below. ALWAYS pick a real trigger.
  Trigger list (use exact names): ${triggerList}
  ${channelTriggerHints}
  Do NOT add trigger-type entries in the capabilities array.
  In the instructions, write the following line at the very top (no heading before it):
  Where this agent works: {{icon:channelKey}} [[TriggerName]]
  (Replace channelKey with the icon key for that trigger, e.g. "Where this agent works: {{icon:teams}} [[Teams - When a user messages in Teams]]")`
    : `TRIGGERS: Match EXACTLY ${channels.length} channel(s) to triggers from the list below. ALWAYS pick a real trigger. Do NOT add trigger-type entries in the capabilities array.
  Trigger list (use exact names): ${triggerList}
  Channels to match: ${channels.join(', ')}
  ${channelTriggerHints}
  In the instructions, write ONE "Where this agent works" line at the very top listing all channels (no heading before it):
  Where this agent works: {{icon:key1}} [[Trigger1]], {{icon:key2}} [[Trigger2]]
  (e.g. "Where this agent works: {{icon:teams}} [[Teams - When a user messages in Teams]], {{icon:outlook}} [[Outlook - On New Email]]")`;

  return `${audienceSection}

${triggerGuidance}

PURPOSE: Write 1-3 sentences explaining the agent's main objectives and use cases.

CAPABILITIES: Generate capabilities (knowledge and action types only — no trigger entries).
- action: 1-3 actions. ONLY use exact names from this list: ${toolList}
- knowledge: Generate 2-4 knowledge sources that sound like real documents and sites an employee at this org would actually recognize — specific enough to be believable, not generic placeholders. Use "Source - Description" format.
  Source prefixes: "SharePoint - " for sites/portals/libraries, "Word - " for Word documents, "Excel - " for spreadsheets/trackers, "OneDrive - " for personal files, "Dataverse - " for databases/tables, "Website - " for web pages.
  Name them like a real SharePoint admin would — title case, descriptive, domain-specific. Examples by domain:
  HR: "SharePoint - Benefits & Total Rewards Hub", "Word - New Hire Onboarding Guide", "Excel - PTO Accrual Policy", "SharePoint - Employee Handbook Portal"
  IT: "SharePoint - IT Help Desk Knowledge Base", "Word - Laptop Provisioning Checklist", "Excel - Approved Software Catalog", "SharePoint - Incident Escalation Runbook"
  Sales: "SharePoint - Product & Pricing Catalog", "Word - Sales Playbook", "Excel - Customer Contract Templates", "Dataverse - Customer Account Records"
  Finance: "SharePoint - Finance Policies & Procedures", "Excel - Budget Tracker", "Word - Expense Reimbursement Guide", "Dataverse - Invoice Records"
  Legal: "SharePoint - Contract Repository", "Word - NDA Template Library", "SharePoint - Compliance & Regulatory Hub"
  Operations: "SharePoint - SOPs & Process Library", "Excel - Vendor Rate Card", "Word - Project Charter Template"

INSTRUCTIONS: Write concise, actionable instructions. Brevity is paramount — every sentence must earn its place.

FORMATTING — MANDATORY: Use "•" (bullet point character) for ALL list items. NEVER use "-" (dash) as a bullet marker. This applies everywhere in the instructions.

## Pill markup syntax — REQUIRED in instructions:
• Triggers: {{icon:channelKey}} [[TriggerName]] — icon token + double-bracket trigger name, always together (e.g. {{icon:teams}} [[Teams - When a user messages in Teams]], {{icon:outlook}} [[Outlook - On New Email]])
• Actions: [[Tool: Service - Action]] — exact name from the tools list above, prefixed with "Tool: "
• Knowledge: [[Source - Description]] — use the same "Source - Description" value as in the capabilities array

## Structure:
Start with the "Where this agent works" line — NO heading:
Where this agent works: {{icon:channelKey}} [[TriggerName]]
(Multiple channels on one line: Where this agent works: {{icon:key1}} [[Trigger1]], {{icon:key2}} [[Trigger2]])
(then a blank line before the first ## section)

## Role & Purpose
• 1-3 sentences defining role and primary goal

## Capabilities & Responsibilities
• Reference each action capability at least once: "You use [[Tool: Service - Action]] to..."
• Reference each knowledge capability at least once: "You have access to [[Source - Description]]..."
• Brief CAN/CANNOT list (2-5 items each max)

## Communication Style & Tone
• 2-5 bullet points ONLY${communicationNote}

## Key Guidelines
• 2-5 most critical principles ONLY
• When to escalate

CRITICAL: NO sub-sections, NO lengthy examples, NO detailed scenarios. Keep each section to 3-5 bullet points maximum. Always use "•" for bullets, never "-".

QUALITY STANDARDS:
• Be SPECIFIC to the domain (e.g., "HR Benefits Specialist" not just "HR Agent")
• Include CONCRETE details about what the agent can do
• Write instructions that are ACTIONABLE and CLEAR
• Use professional language appropriate for ${audienceDeployment}
• ABSOLUTE LIMIT: 100-400 words for instructions — brevity is paramount, anything longer will be rejected
• NO detailed scenarios, NO lengthy examples, NO exhaustive sub-sections
• Put the most important guidelines first (models pay more attention to earlier content)
• REQUIRED: Reference every capability using [[Tool: ...]] or [[Source - ...]] markup — this renders interactive pills in the UI
• Focus on HIGH-IMPACT guidelines only — skip obvious or low-value advice
• ONLY use triggers and tools from the provided lists above (exact names)

INSTRUCTION QUALITY PRINCIPLES:
• Write in the agent's voice. If the agent should be formal, write formal instructions. If casual, write casual ones.
• Be specific, not generic. Instead of "Be helpful", write "When a user reports a hardware issue, ask for the device model and error message before troubleshooting."
• Include edge cases. Good instructions anticipate what could go wrong: "If the user asks about something outside your scope, acknowledge the question and direct them to the appropriate resource."
• Keep sections focused. Each ## section should cover one concern: tone, escalation, knowledge boundaries, response format, etc.`;
};

export interface ComponentDescriptionInput {
  id: string;
  name: string;
  type: string;
  source?: string;
}

/**
 * LLM-generates a one-sentence description for each component, explaining what it
 * specifically does for the agent (not just what the component is in general).
 * Returns a map of component id → description string.
 */
export const generateComponentDescriptions = async (
  agent: { name: string; description: string; purpose: string },
  components: ComponentDescriptionInput[]
): Promise<Record<string, string>> => {
  if (components.length === 0) return {};

  const componentList = components
    .map(c => `id="${c.id}" type="${c.type}" name="${c.source ? `${c.source} - ${c.name}` : c.name}"`)
    .join('\n');

  const raw = await callModel({
    model: 'fast',
    maxTokens: 800,
    system: `You write concise component descriptions for AI agent configurations.
For each component listed, write exactly 1 sentence (8–14 words) explaining what it does FOR THIS SPECIFIC AGENT.
Be concrete and action-oriented — start with a verb (e.g. "Retrieves…", "Sends…", "Monitors…", "Creates…").
Avoid generic phrases like "provides data" or "enables functionality".
Return ONLY a JSON array with no extra text: [{"id":"...","description":"..."}]`,
    messages: [{
      role: 'user',
      content: `Agent: "${agent.name}" — ${agent.description}\nPurpose: ${agent.purpose || agent.description}\n\nComponents:\n${componentList}`,
    }],
  });

  try {
    const jsonStr = raw.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const items: Array<{ id: string; description: string }> = JSON.parse(jsonStr);
    const validIds = new Set(components.map(c => c.id));
    const map: Record<string, string> = {};
    for (const item of items) {
      if (validIds.has(item.id) && typeof item.description === 'string') {
        map[item.id] = item.description;
      }
    }
    return map;
  } catch {
    return {};
  }
};
