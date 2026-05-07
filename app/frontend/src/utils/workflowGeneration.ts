import { callModel } from './modelClient';
import { WorkflowNode } from '../types';

export const TRIGGER_PLACEHOLDER_NODE: WorkflowNode = {
  id: 'trigger-placeholder',
  type: 'trigger',
  label: 'Add a trigger',
  placeholder: true,
};

/**
 * Use Claude API to generate workflow nodes from user description.
 * If channels is null/empty, the trigger source is unknown — a placeholder trigger
 * node is prepended instead of a real trigger, and Claude is told to skip it.
 */
export const generateWorkflowNodes = async (
  userDescription: string,
  agentName: string,
  trigger?: string | null,
  onProgress?: (message: string) => void
): Promise<WorkflowNode[]> => {
  const triggerKnown = trigger != null && trigger.trim().length > 0;
  // trigger === null means the fuzzy flow explicitly has no trigger yet → use placeholder
  // trigger === undefined means caller didn't specify → let the LLM generate its own trigger
  const awaitingChannel = trigger === null;

  const systemPrompt = `You are an expert workflow architect who designs production-ready automation workflows. Your job is to take a user's workflow description and create a comprehensive, logical sequence of workflow nodes.

WORKFLOW NODE TYPES:
1. **trigger**: Events that start the workflow (e.g., "When a new file arrives", "When an email is received")
   - Common connectors: SharePoint, Outlook, OneDrive, Forms, Dataverse
   - Example: { type: 'trigger', label: 'When a new invoice arrives in SharePoint', connector: 'SharePoint' }

2. **ai-action**: AI-powered data processing steps (e.g., "Extract data", "Classify content", "Summarize text")
   - No connector needed - this is Claude AI processing
   - Include config with task description and entities
   - Example: { type: 'ai-action', label: 'Extract invoice data', config: { task: 'Extract invoice details', entities: ['Amount', 'Date', 'Vendor'] } }

3. **agent**: Delegated tasks to specialized AI agents (e.g., "Validate data", "Review content")
   - Include config with instructions, knowledge sources, and tools
   - Example: { type: 'agent', label: 'Agent - Compliance validation', config: { instructions: 'Review for compliance', knowledge: ['Company policies'], tools: ['Dataverse MCP'] } }

4. **condition**: If/else branching logic to route workflow based on criteria
   - Creates two branches: 'true' and 'false'
   - Example: { type: 'condition', label: 'If/else' }

5. **action**: External system actions (e.g., "Send email", "Create record", "Update database")
   - Common connectors: Outlook, Teams, Dataverse, SharePoint, Slack
   - Include branch property if following a condition
   - Example: { type: 'action', label: 'Send approval email', connector: 'Outlook', branch: 'true' }

AVAILABLE CONNECTORS:
- SharePoint: Document storage and management
- Outlook: Email communication
- Dataverse: Database and CRM operations
- OneDrive: Personal file storage
- Teams: Team collaboration and notifications
- Forms: Data collection
- Slack: Team messaging

WORKFLOW DESIGN PRINCIPLES:
1. **Logical flow** - Arrange nodes in the order they execute
2. **Use AI wisely** - Use ai-action for data extraction/transformation, agents for complex decision-making
3. **Branch appropriately** - Use conditions when the workflow needs different paths based on criteria
4. **End with actions** - Workflows typically end with actions like sending notifications or updating records
5. **Keep it focused** - Generate 3-7 nodes total (quality over quantity)
6. **Meaningful labels** - Each label should clearly describe what happens in that step

NODE STRUCTURE REQUIREMENTS:
- Every node needs: id (unique, format: 'type-number'), type, label
- Triggers and actions need: connector
- AI actions need: config with task and entities
- Agents need: config with instructions, knowledge, tools
- Condition branches: nodes after condition should have branch: 'true' or 'false'

${triggerKnown
  ? `TRIGGER: The workflow trigger is: ${trigger}. Start with exactly ONE trigger node whose connector matches this trigger (e.g. "Outlook - On New Email" → connector: "Outlook", "Recurrence" → connector: "Recurrence").`
  : awaitingChannel
    ? `TRIGGER: The trigger source is not yet known — DO NOT include a trigger node. Start directly with the first processing step (ai-action, agent, or action).`
    : `TRIGGER: Choose the most appropriate trigger for this workflow and start with exactly ONE trigger node.`
}

CRITICAL INSTRUCTIONS:
- Generate a complete, executable workflow based on the user's description
- Make the workflow practical and aligned to real business processes
- Use specific, professional labels (not generic placeholders)
- Ensure the flow makes logical sense from start to finish
- Include appropriate connectors that match the user's domain

Return ONLY a valid JSON array of WorkflowNode objects. No explanations, no markdown, just the JSON array.`;

  const userPrompt = `Design a workflow for: "${userDescription}"

Workflow name: ${agentName}

Generate a complete workflow with appropriate nodes that accomplish this automation. Return only the JSON array of nodes.`;

  try {
    let jsonText = (await callModel({
      model: 'balanced',
      maxTokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })).trim();

    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const nodes: WorkflowNode[] = JSON.parse(jsonText);

    // Fuzzy flow with no channel yet: strip any trigger the LLM may have generated
    // and prepend the placeholder so the user can select a trigger from the card.
    if (awaitingChannel) {
      const nonTriggerNodes = nodes.filter(n => n.type !== 'trigger');
      return [TRIGGER_PLACEHOLDER_NODE, ...nonTriggerNodes];
    }

    return nodes;
  } catch (error) {
    console.error('Error generating workflow nodes:', error);
    onProgress?.('Using default workflow structure...');

    return [
      triggerKnown
        ? { id: 'trigger-1', type: 'trigger', label: `When triggered via ${trigger}`, connector: trigger!.split(' - ')[0] }
        : awaitingChannel
          ? TRIGGER_PLACEHOLDER_NODE
          : { id: 'trigger-1', type: 'trigger', label: 'When triggered', connector: 'Manual' },
      {
        id: 'ai-action-1',
        type: 'ai-action',
        label: 'Process data',
        config: {
          task: 'Process and extract relevant information',
          entities: ['Data', 'Content'],
        },
      },
      {
        id: 'action-1',
        type: 'action',
        label: 'Send notification',
        connector: 'Outlook',
      },
    ];
  }
};

/**
 * Generate a single trigger node given a workflow brief and resolved channels.
 * Used to replace a placeholder trigger once the channel source is known.
 */
export const generateTriggerNode = async (
  brief: string,
  trigger: string
): Promise<WorkflowNode> => {
  const prompt = `Given this workflow description: "${brief}"
And this trigger: ${trigger}

Return a single JSON object for the trigger node that best starts this workflow.
Use this shape: { "id": "trigger-1", "type": "trigger", "label": "<specific event description>", "connector": "<connector name>" }
The connector should match the trigger (e.g. "Outlook - On New Email" → connector: "Outlook", "Recurrence" → connector: "Recurrence").

Return ONLY the JSON object, no explanation.`;

  try {
    let jsonText = (await callModel({
      model: 'fast',
      maxTokens: 200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })).trim();

    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) jsonText = objMatch[0];

    return JSON.parse(jsonText) as WorkflowNode;
  } catch (error) {
    console.error('Error generating trigger node:', error);
    return {
      id: 'trigger-1',
      type: 'trigger',
      label: `When triggered via ${trigger}`,
      connector: trigger.split(' - ')[0],
    };
  }
};
