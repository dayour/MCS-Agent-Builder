import { callModel } from './modelClient';

/**
 * Generate plausible knowledge-source suggestions for an agent under construction.
 *
 * Calls the fast model with the agent's accumulated context, parses a JSON array,
 * and falls back to a deterministic keyword-based generator (`*FromContext`) if
 * the model output can't be parsed or if the call fails.
 *
 * Cleanup note (2026-05-05): this file used to expose 17 home-flow message
 * generators built for the pre-unified-chat onboarding wizard. The chat refactor
 * (commit 234c34b6) deleted the consumers of 15 of them; only this function and
 * its deterministic fallback are still wired into HelperAgent.
 */
export const generateKnowledgeSuggestions = async (
  context: string[],
): Promise<Array<{ name: string; description: string }>> => {
  try {
    const contextText = context.filter(Boolean).join('\n');

    const prompt = `Based on this context about an AI agent being built, generate 4-5 realistic knowledge sources that would plausibly exist in this type of organization.

Context:
${contextText}

Return ONLY a JSON array of objects with this exact format:
[
  {"name": "SharePoint - IT Helpdesk Knowledge Base", "description": "Internal documentation for IT policies, troubleshooting guides, and step-by-step procedures"},
  {"name": "Word - Laptop Provisioning Checklist", "description": "Step-by-step guide for setting up and deploying new employee laptops"}
]

Guidelines:
- Each source name MUST start with one of: SharePoint, Word, Excel, OneDrive, Dataverse, Website
- Do NOT use Teams as a source type — Teams is a deployment channel, not a knowledge source
- Use specific, realistic names that reflect the agent's domain — NOT generic names like "SharePoint - Company Documents"
- Descriptions should be a single sentence explaining what the resource contains
- Mix different source types appropriate to the domain
- Good examples: "SharePoint - Employee Benefits Hub", "Excel - Customer Pricing Sheet", "Word - Onboarding Playbook", "Dataverse - Customer Account Records", "Website - Product Documentation", "OneDrive - Sales Templates"
- Do NOT suggest any source that is already mentioned in the agent's instructions or listed under "Already connected:" in the context

Return ONLY valid JSON, no additional text.`;

    const responseText = await callModel({
      model: 'fast',
      maxTokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return generateKnowledgeSuggestionsFromContext(context);
  } catch (error) {
    console.error('[homeMessageGenerators] Error generating knowledge suggestions:', error);
    return generateKnowledgeSuggestionsFromContext(context);
  }
};

/**
 * Deterministic fallback for `generateKnowledgeSuggestions` — emits common
 * knowledge-source patterns for IT/HR/Sales/Finance domains based on keyword
 * presence in the context. Always returns 3-5 suggestions.
 */
function generateKnowledgeSuggestionsFromContext(
  context: string[],
): Array<{ name: string; description: string }> {
  const contextText = context.join(' ').toLowerCase();
  const sources: Array<{ name: string; description: string }> = [];

  if (
    contextText.includes('it') ||
    contextText.includes('helpdesk') ||
    contextText.includes('support') ||
    contextText.includes('password')
  ) {
    sources.push({ name: 'SharePoint - IT Knowledge Base', description: 'Documentation for IT policies, procedures, and troubleshooting guides' });
    sources.push({ name: 'Word - Laptop Provisioning Checklist', description: 'Step-by-step guide for setting up and deploying new employee laptops' });
  }
  if (
    contextText.includes('hr') ||
    contextText.includes('employee') ||
    contextText.includes('onboard') ||
    contextText.includes('benefit')
  ) {
    sources.push({ name: 'SharePoint - HR Policy Center', description: 'HR policies, employee handbook, and benefits documentation' });
    sources.push({ name: 'Word - Onboarding Playbook', description: 'Step-by-step guide for onboarding new employees' });
  }
  if (
    contextText.includes('sales') ||
    contextText.includes('customer') ||
    contextText.includes('product')
  ) {
    sources.push({ name: 'SharePoint - Sales Playbook', description: 'Sales processes, pricing guides, and customer engagement resources' });
    sources.push({ name: 'Excel - Customer Pricing Sheet', description: 'Current pricing tiers, discount structures, and customer segments' });
  }
  if (
    contextText.includes('finance') ||
    contextText.includes('budget') ||
    contextText.includes('expense')
  ) {
    sources.push({ name: 'Excel - Budget Tracker', description: 'Department budgets, actuals, and financial planning documents' });
    sources.push({ name: 'SharePoint - Finance Policies', description: 'Financial policies, expense guidelines, and approval workflows' });
  }

  if (sources.length < 3) {
    sources.push({ name: 'SharePoint - Company Wiki', description: 'General company knowledge base and internal documentation' });
    sources.push({ name: 'OneDrive - Shared Resources', description: 'Team documents, templates, and reference materials' });
    sources.push({ name: 'Word - Process Documentation', description: 'Step-by-step process guides and standard operating procedures' });
  }

  return sources.slice(0, 5);
}
