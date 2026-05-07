/**
 * Intent classification utilities
 */

import { callModel } from './modelClient';

interface BaseIntentResult {
  audience?: 'customers' | 'employees';
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  isExplicit: boolean; // True if user explicitly mentioned "agent" or "workflow"
  scores: {
    customer: number;
    employee: number;
    workflow: number;
    agent: number;
  };
}

export interface LocalIntentResult extends BaseIntentResult {
  type: 'agent' | 'workflow';
}

export interface LLMIntentResult extends BaseIntentResult {
  type: 'agent' | 'workflow' | 'unclear' | 'neither';
  clarifyingQuestion?: string;
  channel?: string; // Where the agent/workflow will be deployed (e.g., 'website', 'teams', 'slack', 'servicenow', 'sharepoint')
  agentType?: 'CA' | 'DA' | 'DW'; // CA = Custom Agent, DA = Declarative Agent (Teams/Microsoft 365), DW = Digital Worker (AI Teammate)
  suggestedName?: string; // Suggested title/name for the agent or workflow
  suggestedDescription?: string; // Suggested description based on user input
  suggestedInstructions?: string; // Suggested AI agent instructions (only for agents, not workflows)
  iconKey?: string; // Icon key selected by LLM based on the use case
  gradientKey?: string; // Gradient key selected by LLM for visual theming
  neitherReason?: string; // Why this request doesn't fit an agent or workflow
  suggestedAlternative?: string; // What tool/approach would better serve this need
  isDWIntent?: boolean; // True if request clearly describes a Digital Worker / AI Teammate (own M365 identity)
}

/**
 * Normalizes channel names to standard display format
 * Maps various LLM outputs and legacy names to the canonical names used in the publish dropdown
 */
export function normalizeChannelName(channel?: string): string | undefined {
  if (!channel) return undefined;
  const lower = channel.toLowerCase();
  const channelNameMap: Record<string, string> = {
    'teams': 'Microsoft 365',
    'microsoft teams': 'Microsoft 365',
    'teams & m365 copilot': 'Microsoft 365',
    'm365': 'Microsoft 365',
    'microsoft m365': 'Microsoft 365',
    'microsoft 365': 'Microsoft 365',
    'website': 'Website',
    'my website': 'Website',
    'webchat': 'Website',
    'web': 'Website',
    'slack': 'Slack',
    'sharepoint': 'SharePoint',
    'email': 'Email',
    'outlook': 'Email',
    'whatsapp': 'WhatsApp',
  };
  return channelNameMap[lower] || channel;
}

/**
 * Determines agent type (CA or DA) based on the deployment channel
 * @param channel The deployment channel (e.g., 'teams', 'website', 'outlook')
 * @returns 'DA' for Teams/Microsoft 365, 'CA' for other channels, undefined if channel is unknown
 */
export function determineAgentType(channel?: string): 'CA' | 'DA' | undefined {
  if (!channel) return undefined;
  const channelLower = channel.toLowerCase();
  if (channelLower === 'teams' || channelLower === 'microsoft 365' || channelLower === 'microsoft teams') {
    return 'DA';
  }
  return 'CA';
}

/**
 * LLM-based intent classification using Claude
 * Analyzes user input to determine if they need an agent or workflow
 * Can return 'unclear' for ambiguous requests
 * @param userInput The user's input to classify
 * @param clarificationAttempt How many times we've already asked for clarification (0 = first time)
 */
export async function classifyIntentWithLLM(userInput: string, clarificationAttempt: number = 0): Promise<LLMIntentResult> {
  try {
    const response_text = await callModel({
      model: 'balanced',
      maxTokens: 900,
      messages: [{
        role: 'user',
        content: `Analyze this user request and determine if they need an AI agent, a workflow automation, if the intent is unclear, or if neither is the right fit.

User request: "${userInput}"

**What you're classifying:**

**AI Agent** — on-demand conversational assistant
Core value: Handles varied, unpredictable requests so users always get help without waiting for a person.
Best for:
- Customer support (every customer's question is different)
- Employee help desks (HR/IT questions, policies, how-to guidance)
- Personal productivity (scheduling, research, drafting, decision support)
- Any situation where the interaction is different every time
NOT for: tasks that always follow the exact same steps, or one-time build/design tasks

**Workflow** — reliable background automation
Core value: Eliminates manual work by running the same process automatically every time it's triggered.
Best for:
- Approval routing (new document → notify approver → log decision)
- Scheduled operations (weekly reports, daily data sync, recurring notifications)
- Event-driven pipelines (new file arrives → extract data → update CRM)
- System-to-system integrations that repeat on a predictable schedule
NOT for: requests that need to adapt, reason, or respond differently each time

**Neither** — this tool can't help with this
Return "neither" when the request is clearly NOT an agent or workflow:
- Building an application, custom UI, or form (→ Power Apps, SharePoint)
- Writing, generating, or reviewing code (→ GitHub Copilot, Azure DevOps)
- Creating documents, reports, templates, or presentations (→ Copilot in Word/Excel/PowerPoint)
- Designing something visual or creating branded assets (→ design tools)
- Building a dashboard or data analysis environment (→ Power BI, Excel)
- One-time setup or configuration tasks that don't repeat
- Anything better served by a specific Microsoft 365 app

When returning "neither": set neitherReason and suggestedAlternative.

**When to return "unclear":**
Be CONSERVATIVE - when in doubt, return "unclear". The request could reasonably be EITHER an agent OR a workflow if:
- Contains words like "help", "assist", "manage", "handle", "review", "audit", "compare" (could be conversational help OR automation)
- Mentions a recurring/scheduled task but doesn't clarify if it needs conversation vs. automation
- Could benefit from EITHER approach (e.g., "audit invoices" - could be automated validation OR conversational assistance)
- User doesn't explicitly indicate automation ("automatically", "workflow") or conversation ("chatbot", "answer questions")

Examples of UNCLEAR cases:
- "Help team deal with complaints" (conversational OR automated routing?)
- "Audit freight invoices weekly" (automated validation OR conversational help?)
- "Manage employee onboarding" (chatbot OR automated workflow?)
- "Review support tickets" (help review OR auto-triage?)

Only return agent/workflow if it's CLEARLY one or the other - not just probably.

**Explicit keywords override everything:**
- If input contains "AI agent", "chatbot", "chat bot", "virtual assistant" → classify as AGENT
- If input contains "workflow automation" or "automated workflow" → classify as WORKFLOW
- If input contains BOTH → classify as UNCLEAR

**Digital Worker / AI Teammate detection:**
Set isDWIntent: true if the request clearly describes an agent that needs its own Microsoft 365 identity — for example: "digital worker", "digital coworker", "AI teammate", "AI coworker", "agent with its own email", "agent that can send emails as itself", "have its own identity", "be added to groups", "be @mentioned in Teams as itself", or language that implies the agent should exist as a persistent person-like entity in the org. This is a strong signal — only set true when the intent is unambiguous.

**Audience (for agents only):**
- **Customers**: external users, clients, patients, buyers, students
- **Employees**: internal staff, team members, workers

**Channel Detection:**
Only set a channel if the user EXPLICITLY mentions WHERE it will be deployed (e.g., "Teams bot", "on our website", "in Slack"). Generic terms like "chatbot" don't indicate a channel.

Channels: website, teams, slack, outlook, sharepoint, onedrive, excel, word, powerpoint, dataverse, servicenow

**Name and Description:**
Suggest a short name (2-5 words) and brief description (1-2 sentences) based on the user's input. Don't include the channel in the name. If input is too vague, leave as null.

**AI Agent Instructions (agents only):**
Draft initial instructions as a bulleted list:
- If a channel is identified, start with: "{{icon:channelname}} [[When trigger]] action."
  - Examples: "{{icon:website}} [[When a user messages on Website]] respond to questions."
  - "{{icon:teams}} [[When mentioned]] provide assistance."
- State the core purpose
- Include 3-5 specific capabilities
- If input is too vague, leave as null

**Icon Selection:**
Choose the most appropriate icon key that best represents this agent/workflow. Pick ONE from this list:

Domain icons:
- Business functions: hr, it, sales, finance, legal, marketing, customer-service, customer-success, communications, events, product, training, recruiting, procurement, compliance
- Industries: healthcare, insurance, education, real-estate, travel, ecommerce, manufacturing
- Technical: security, devops, data, project, operations, automation, infrastructure, database, language
- Productivity: chatbot, scheduling, documents, approvals, monitoring, email, content, design, research, qa
- Specialized: knowledge, onboarding, feedback, tickets, search, notifications, files
- Fallback: generic

Template icons (use with tpl: prefix):
- General: tpl:weather, tpl:team-navigator, tpl:safe-travels, tpl:wellness-check, tpl:status-tracker, tpl:education, tpl:store-operations, tpl:book, tpl:truck, tpl:trophy, tpl:gong
- Business: tpl:financial-insights, tpl:sustainability-insights, tpl:case-management, tpl:supply-chain, tpl:salesforce-duplicate, tpl:manufacturing
- UX/Feedback: tpl:thumbs-like-dislike, tpl:window-settings, tpl:self-help, tpl:website-qa, tpl:voice, tpl:inclusivity, tpl:benefits, tpl:kudos, tpl:question-sources
- Analysis: tpl:filter, tpl:prioritization, tpl:comparison, tpl:decision
- Government: tpl:citizen-services

If none fit perfectly, use: generic

**Gradient Selection:**
Choose a gradient key for visual theming. Options: purple, blue, green, orange, pink, teal, red, yellow

**Clarifying Questions (if unclear):**
${clarificationAttempt === 0 ? `
Keep it concise and direct. Example: "Do you need an agent that can chat with users, or a workflow automation?"
` : `
Provide more explanation with examples. Example: "Would you like an **interactive agent** that can chat with users in different situations, or an **automated workflow** that follows the same steps every time?"
`}

Respond in this exact JSON format:
{
  "type": "agent" or "workflow" or "unclear" or "neither",
  "audience": "customers" or "employees" or null,
  "channel": "website" or "teams" or other channel name, or null,
  "suggestedName": "short title" or null,
  "suggestedDescription": "brief summary" or null,
  "suggestedInstructions": "instructions for agents only" or null,
  "iconKey": "icon-key-from-list-above" or null,
  "gradientKey": "gradient-key-from-list-above" or null,
  "confidence": "high" or "medium" or "low",
  "confidenceReason": "brief explanation",
  "reasoning": "your reasoning",
  "clarifyingQuestion": "question if unclear, otherwise null",
  "neitherReason": "why this isn't an agent or workflow (only if type is neither), otherwise null",
  "suggestedAlternative": "specific tool or approach that would serve this better (only if type is neither), otherwise null",
  "isDWIntent": true or false
}`
      }],
    });

    // Extract JSON from response
    const jsonMatch = response_text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);

    const agentType = determineAgentType(result.channel);
    if (agentType) {
      console.log('🎯 [LLM Classification] Setting agentType:', agentType, 'for channel:', result.channel);
    }

    return {
      type: result.type,
      audience: result.audience || undefined,
      channel: normalizeChannelName(result.channel) || undefined,
      agentType,
      suggestedName: result.suggestedName || undefined,
      suggestedDescription: result.suggestedDescription || undefined,
      suggestedInstructions: result.suggestedInstructions || undefined,
      iconKey: result.iconKey || undefined,
      gradientKey: result.gradientKey || undefined,
      confidence: result.confidence,
      confidenceReason: result.confidenceReason,
      clarifyingQuestion: result.clarifyingQuestion || undefined,
      neitherReason: result.neitherReason || undefined,
      suggestedAlternative: result.suggestedAlternative || undefined,
      isDWIntent: result.isDWIntent === true,
      isExplicit: result.isExplicit || false,
      scores: {
        customer: result.audience === 'customers' ? 10 : 0,
        employee: result.audience === 'employees' ? 10 : 0,
        workflow: result.type === 'workflow' ? 10 : 0,
        agent: result.type === 'agent' ? 10 : 0
      }
    };
  } catch (error) {
    console.error('Error in LLM classification:', error);
    // Fallback to local classification
    return classifyIntentLocally(userInput);
  }
}

export function classifyIntentLocally(userInput: string): LocalIntentResult {
  const allResponses = userInput.toLowerCase();

  // Check for explicit type mentions - these should bypass ambiguity
  const explicitlyMentionsAgent = allResponses.includes(' agent') || allResponses.startsWith('agent') || allResponses.endsWith('agent');
  const explicitlyMentionsWorkflow = allResponses.includes('workflow');

  // Define scoring factors
  const scoringFactors = {
    customerWords: ['customer', 'client', 'user', 'patient', 'buyer', 'guest', 'visitor', 'shopper', 'student', 'learner'],
    employeeWords: ['employee', 'staff', 'team', 'worker', 'personnel', 'member'],
    workflowVerbs: ['automate', 'streamline', 'orchestrate', 'route', 'triage'],
    workflowNouns: ['workflow', 'process', 'pipeline', 'steps', 'sequence', 'procedure', 'approval', 'publication'],
    workflowAdverbs: ['automatically'],
    workflowGoals: ['reduce manual', 'eliminate repetitive', 'connect tools', 'connect systems', 'automate tasks', 'automate process'],
    agentVerbs: ['help', 'assist', 'guide', 'answer', 'recommend', 'suggest', 'advise', 'support', 'find', 'book', 'manage', 'schedule', 'track', 'coordinate'],
    agentGoals: ['24/7', 'instant', 'better decisions', 'recommendations', 'self-service', 'faster response']
  };

  // Calculate scores for each type
  let customerScore = 0;
  let employeeScore = 0;
  let workflowScore = 0;
  let agentScore = 0;

  // Score audience (customer vs employee)
  scoringFactors.customerWords.forEach(word => {
    if (allResponses.includes(word)) customerScore += 2;
  });
  scoringFactors.employeeWords.forEach(word => {
    if (allResponses.includes(word)) employeeScore += 2;
  });

  // Score workflow indicators
  scoringFactors.workflowVerbs.forEach(verb => {
    if (allResponses.includes(verb)) workflowScore += 3;
  });
  scoringFactors.workflowNouns.forEach(noun => {
    if (allResponses.includes(noun)) workflowScore += 2;
  });
  scoringFactors.workflowAdverbs.forEach(adverb => {
    if (allResponses.includes(adverb)) workflowScore += 4; // Strong workflow indicator
  });
  scoringFactors.workflowGoals.forEach(goal => {
    if (allResponses.includes(goal)) workflowScore += 3;
  });

  // Score agent indicators
  scoringFactors.agentVerbs.forEach(verb => {
    if (allResponses.includes(verb)) agentScore += 1;
  });
  scoringFactors.agentGoals.forEach(goal => {
    if (allResponses.includes(goal)) agentScore += 2;
  });

  // Explicit type mentions get very high scores
  if (explicitlyMentionsAgent) {
    agentScore += 10; // Strong signal that user wants an agent
  }
  if (explicitlyMentionsWorkflow) {
    workflowScore += 10; // Strong signal that user wants a workflow
  }

  // Determine recommendation type based on scores
  let recommendationType: 'agent' | 'workflow';
  let audience: 'customers' | 'employees' | undefined = undefined;

  // Calculate combined audience score
  const audienceScore = Math.max(customerScore, employeeScore);

  // Decision logic:
  // 1. If workflow score is significantly higher than agent score, it's a workflow
  // 2. If clear audience (customer/employee) AND agent indicators, it's an agent
  // 3. Otherwise compare all scores

  if (workflowScore >= 3 && workflowScore > agentScore * 2) {
    // Strong workflow signals that dominate agent signals → workflow
    recommendationType = 'workflow';
  } else if (audienceScore > 0 && agentScore >= 2) {
    // Has audience AND multiple agent verbs → it's an agent for that audience
    recommendationType = 'agent';
    audience = customerScore > employeeScore ? 'customers' : 'employees';
  } else if (workflowScore > agentScore && workflowScore >= 3) {
    // Workflow indicators are present and stronger → workflow
    recommendationType = 'workflow';
  } else {
    // Default to agent
    recommendationType = 'agent';
    // Determine audience
    if (customerScore > employeeScore && customerScore >= 2) {
      audience = 'customers';
    } else if (employeeScore > customerScore && employeeScore >= 2) {
      audience = 'employees';
    } else {
      // Leave audience undefined if unclear - will trigger interview mode
      audience = undefined;
    }
  }

  // Calculate confidence based on score distribution
  let confidence: 'high' | 'medium' | 'low';
  let confidenceReason: string;

  if (recommendationType === 'workflow') {
    if (explicitlyMentionsWorkflow || (workflowScore >= 6 && workflowScore > agentScore * 2)) {
      confidence = 'high';
      confidenceReason = explicitlyMentionsWorkflow
        ? 'user explicitly requested a workflow'
        : 'strong automation signals and clear multi-step process indicators';
    } else if (workflowScore >= 3) {
      confidence = 'medium';
      confidenceReason = 'workflow indicators present but could also be an agent-assisted process';
    } else {
      confidence = 'low';
      confidenceReason = 'weak signals - you might want to clarify your goals';
    }
  } else {
    // Agent recommendation
    if (explicitlyMentionsAgent || (audienceScore >= 2 && agentScore >= 2)) {
      confidence = 'high';
      confidenceReason = explicitlyMentionsAgent
        ? 'user explicitly requested an agent'
        : 'clear audience and strong interactive/conversational signals';
    } else if (audienceScore >= 2) {
      confidence = 'medium';
      confidenceReason = 'audience is clear but intent could be refined';
    } else {
      confidence = 'low';
      confidenceReason = 'unclear audience or goals';
    }
  }

  return {
    type: recommendationType,
    audience,
    confidence,
    confidenceReason,
    isExplicit: explicitlyMentionsAgent || explicitlyMentionsWorkflow,
    scores: {
      customer: customerScore,
      employee: employeeScore,
      workflow: workflowScore,
      agent: agentScore
    }
  };
}
