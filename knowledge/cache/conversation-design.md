<!-- CACHE METADATA
last_verified: 2026-04-07
sources: [MS Learn, MCS UI, community, MS Learn guidance/topic-authoring-best-practices, MS Learn guidance/implement-overview, MS Learn guidance/channels, MS Learn guidance/architecture-overview, MS Learn guidance/cux-principles, MS Learn whats-new, 2026 Wave 1 Release Plan, MS Learn batch-testing-prompts, WebSearch Mar 2026, WebSearch Apr 2026, MS Learn whats-new Apr 2026, 2026 Wave 1 planned features Apr 2026]
confidence: high
refresh_trigger: weekly
-->
# MCS Conversation Design & Teams — Quick Reference

## Flow Control Nodes

| Node | Function |
|------|----------|
| **Redirect** | Call subtopic (returns when done). Input/output vars supported. |
| **End current topic** | Ends current only. Returns to caller if redirected. |
| **End all topics** | Ends ALL. Does NOT clear globals. |
| **End Conversation** | Triggers CSAT survey. |
| **Transfer conversation** | Handoff to live agent. |
| **Clear variable values** | Resets globals. |

**MCS does NOT use Bot Framework terms**: Redirect = BeginDialog, End current = EndDialog, End all = EndConversation. No ReplaceDialog equivalent.

## Built-in Entity Types

**String**: Person name, Organization, Email, Phone, URL, City, State, Country, Continent, Street address, Zip, Point of interest, Event, Language, Color
**Number**: Number, Integer, Ordinal, Money, Percentage, Age, Speed, Temperature, Weight
**Other**: Boolean, DateTime, Choice (multiple-choice), User's entire response (String)

**Custom**: Closed List (with smart matching/fuzzy logic) or Regex (NLU/CLU: .NET syntax; NLU+: JavaScript)

## Slot Filling

- **Proactive**: user gives multiple values at once → agent auto-maps
- Filled slots skip questions by default (configurable: "Ask every time")
- Question node accepts up to **5 different entity types**

## Error Handling

- **OnError** system topic: error code, conversation ID, timestamp
- Key codes: 2000 (infinite loop), 2001 (invalid content), 2002 (Dataverse), 2003 (flow), 2007 (too much content)
- Connected agent: `AuthMismatch`, `BotNotPublished`, `ChainingNotSupported`
- Fallback: max **2 questions** before handoff, **3+ message variations** to avoid robotic feel

## Escalation

**Implicit** (agent detects "talk to agent") or **Explicit** (Transfer conversation node).

Context passed: `va_Scope`, `va_LastTopic`, `va_Topics`, `va_LastPhrases`, `va_ConversationId`, `va_AgentMessage`, all topic variables.

Hubs: Dynamics 365 Omnichannel (native), LivePerson, Generic adapter.

## Multi-Agent Decision

**Use connected agents when**: >30-40 tools/topics, similar descriptions confusing planner, different teams/publishing/ALM, reusable across parents.
**Use child agents when**: single team, same auth, no independent publishing needed.
**Multi-level chaining NOT supported.** Global vars NOT shared across agents.

## Teams Integration

- Deploy: publish → add Teams channel → install → share → admin approval
- **Personal chat**: full features, SSO supported
- **Team channels**: @mention, needs "everyone in org" security
- **Group/meeting chats**: no manual auth + SSO (use "Authenticate with Microsoft")
- **Conversation Start**: runs ONCE per user install; "start over" forces latest version
- **Admin**: only icon/description changes need re-approval; content changes do not

### Teams SSO

1:1 chats only. "Authenticate with Microsoft" is simplest. Manual: set URI to `api://botid-{teamsbotid}`.

## Proactive Messaging (Teams)

Power Automate flow → personal chat only. Can send text + Adaptive Cards. Agent must be installed by recipient. **Billing**: counts as Copilot Credits even without user response. NOT logged in transcripts/analytics.

## Quick Replies

Send message (default), Open URL, Make a call, Send hidden message. Rich types: Text, Image, Video, Basic Card, Adaptive Card, Speech override, Message variations (random selection prevents repetition).

## Send HTTP Request Node (GA)

Direct HTTP calls from topics — avoids Power Automate flow overhead and reduces latency:
- Supports GET, POST, PUT, DELETE with custom headers, body, parameters
- Response stored as Power Fx variable with IntelliSense support
- Error handling: default raises OnError, or store HTTP status code + error body in variables and continue
- Recommended over cloud flows for simple API calls (per MS performance best practices)

## Topic Authoring Best Practices (MS Learn Guidance)

### Four Topic Trigger Types
1. **User utterance + NLU** — entry point topics with trigger phrases
2. **Redirect action** — reusable bite-size topics called by other topics (no trigger phrases needed)
3. **Both** — topic can fire from NLU or explicit redirect
4. **Events** — custom events, inactivity, etc.

### Avoid Topic Overlap
- Monitor "did you mean" (Multiple Topics Matched system topic) for overlap signals
- Compare trigger phrases across topics, remove ambiguous pairs
- Avoid same words in different topics' trigger phrases
- Create **disambiguation topics** for overlapping intents (use entity slot filling to clarify)

### Use Entities to Reduce Topics
Instead of duplicating similar topics (Order Pizzas, Order Burgers, Order Drinks), create one "Order" topic with a "FoodType" entity.

### Performance Best Practices (MS Learn Feb 2026)
- Place API calls strategically to avoid making users wait
- Cache retrieved info in variables instead of repeated API/flow calls
- Use direct connector calls or Send HTTP Request instead of cloud flows where applicable
- Understand NLU vs generative orchestration tradeoff (NLU: specific intents, lower latency; GenAI: broader inputs, higher latency)
- Turn on **express mode** for flows

## Multi-Agent Orchestration (GA, Nov 2025)

- Agents can call other agents as tools for task-specific delegation
- Connect agents within environment or from external sources (Fabric data agents)
- Enables modular, specialist agent architecture
- **Multi-level chaining NOT supported.** Global vars NOT shared across agents.

## Request for Information (Preview, Nov 2025)

Pause an agent flow to collect details from designated reviewers via Outlook, then resume execution using their responses as dynamic parameters. Handles missing data/context without hard-coded values.

## File & Image Input (GA, Aug 2025)

Users can upload files and images for agent analysis. Agent can pass files to downstream systems via Agent Flows, Power Automate, connectors, tools, and topics.

## Code Interpreter in Chat (GA, Aug 2025)

Agent can generate Python code-based actions from natural language. Users can upload Excel/CSV/PDF for agent to analyze using Python code.

## Work IQ Tools (Preview, Mar 2026)

Connect agents to the Work IQ service for real-time work insights from M365. Six tools: Mail, Calendar, Teams, Copilot, User, Word. Each scoped to the user's permissions. Adds deep organizational context to agent responses.

## Chain of Thought (CoT) in Test Chat (Mar 2026)

View the agent's intermediate reasoning steps during testing. Shows considerations and decisions made as the agent processes inputs and generates outputs. Available for selected models: GPT-5 Reasoning, Claude Sonnet, Claude Opus.

## Guidance Hub Architecture (Jan 2026)

MS Learn now organizes MCS guidance into 5 pillars: Plan, Implement, Manage, Improve, Extend. Key new articles:
- Architecting agent solutions (architecture patterns for M365 Copilot)
- Generative orchestration capabilities
- Multi-agent orchestration patterns
- Autonomous agent capabilities
- Integration strategies
- Evaluation frameworks and common evaluation approaches

## Advanced Approvals (GA Mar 2026)

Multi-stage and AI-powered approvals for agent flows. Key capabilities:
- **Multi-stage approvals**: Complex approval processes with multiple stages, each with its own stakeholders
- **Conditional approvals**: Conditions between stages for flexible decision-making (auto-approve, reject, skip, route)
- **AI stage**: LLM-powered approval decisions with configurable model selection and instructions. Uses Copilot Credits. Favor powerful models (e.g., GPT-o3 over GPT-4.1) for approval decisions.
- Configure via the approval viewer in agent flows

## Batch Testing for Prompts (Preview)

Systematic prompt validation through Copilot Studio, Power Apps, or Power Automate:
- Upload CSV or AI-generate test datasets for comprehensive evaluation
- Define evaluation criteria: Response quality, Response matches, JSON correctness
- Configure passing score thresholds
- Track accuracy progression across multiple test runs
- Compare outcomes from different runs to identify regressions
- Access via Tools > filter on prompts > Test hub (Preview) in Copilot Studio

## Custom MCP Servers (Preview Mar 2026, GA Apr 2026)

Connect any agent to any external data with custom MCP servers. Enables connecting to non-Microsoft MCP servers for dynamic, real-time content.

## New: Accessibility Best Practices for Adaptive Cards (Mar 2026)

MS Learn published guidance on adaptive card accessibility: supporting screen readers, keyboard navigation, and Teams-specific scenarios for inclusive agent experiences. Source: https://learn.microsoft.com/microsoft-copilot-studio/adaptive-card-accessibility-tips

## New: Question and Reaction Analytics (GA Mar 2026)

View and filter detailed lists of user questions and reactions from agent conversations. Use this data to identify gaps, create evaluation test sets, and export data for further analysis. Session-level CSAT values now included in transcript downloads.

## Generative Orchestration Guidance (MS Learn, Jan 2026)

When using generative orchestration (default for modern agents):
- **Description is #1 routing signal** — write clear, specific topic/tool descriptions
- Generative orchestration selects tools, plans actions, composes responses dynamically
- Use "by agent" trigger for topics the planner should route to
- Classic NLU (trigger phrases) still available for deterministic intent matching
- Tradeoff: NLU = lower latency + specific intents; GenAI = broader inputs + higher latency
- **Express mode** for flows: accelerates flow execution, reduces timeouts (Preview Oct 2025)

## Topic Organization with Periods Warning

Avoid using periods (`.`) in topic names. It is not possible to export a solution that contains an agent with periods in the name of any of its topics.

## Reassign Agent Owner (GA Mar 2026)

Use Power Platform API to reassign an agent's owner. Enables admin-level agent management without Copilot Studio UI.

## Upcoming: Unified Error/Warning/Governance View (Preview Apr 2026, GA Jun 2026)

See a unified view of errors, warnings, and governance notifications in a single pane, replacing the need to check multiple locations.

## Upcoming: MCP in Agent Workflows (Preview Apr 2026, GA Oct 2026)

Use MCP-compliant tools directly in agent workflows (agent flows), not just in generative orchestration.

## Upcoming: SharePoint Lists as Knowledge (Preview Apr 2026, GA May 2026)

Real-time connection to SharePoint list data as a knowledge source. Enables structured data retrieval beyond document-based knowledge.

## Upcoming: Enforce Safe Sharing (Preview Apr 2026, GA Jun 2026)

Detect credential oversharing in agent configurations. Helps admins identify and remediate security risks.

## Upcoming: Code Interpreter on SharePoint (Preview Mar 2026, GA May 2026)

Use code interpreter to analyze SharePoint-sourced data (Excel/CSV/PDF) directly in agent conversations.

## Upcoming: Triggers with End-User Credentials (Preview Apr 2026, GA Jun 2026)

Configure autonomous agent triggers that run with end-user credentials instead of maker credentials. **(Updated: Timeline shifted from Mar/May to Apr/Jun per 2026 Wave 1 plan.)**

## New: Bing Custom Search as Knowledge Source (GA Mar 2026)

Add Bing Custom Search as a knowledge source to ground your agent's responses in a curated, scoped web index by using a Custom Configuration ID.

## New: Agent Node in Agent Flows (GA Mar 2026)

Use an agent node to call a Copilot Studio agent from an agent flow, enabling agent-to-agent orchestration within workflow contexts.

## New: Reprompt Messages with Randomization (GA Mar 2026)

Configure reprompt messages in Question nodes with randomization support to improve conversation recovery for retry prompts, entity recognition failures, and voice scenarios.

## New: Post-Call Action Topics for Voice Agents (GA Mar 2026)

Configure post-call action topics for voice-enabled agents to trigger backend actions automatically after a call ends, based on how the conversation concluded.

## New: Prompt Assistant in Prompt Builder (GA Mar 2026)

Use the Prompt assistant in Prompt builder to draft prompts faster with GPT model-powered suggestions. Reduces time to craft effective prompts.

## Removed/Deprioritized Features (Feb 2026 Change History)

The following features were **removed from the release plan** and will not be delivered:
- **SSO for non-Entra ID connections** — deprioritized (Feb 27, 2026)
- **Test and debug agent actions in Copilot Studio** — deprioritized (Feb 12, 2026)
- **Lead Manager and Customer Brief templates** — deprioritized (Oct 13, 2025)

## Design Checklist

- [ ] Welcome message with capabilities + suggested actions
- [ ] Fallback with 3+ message variations
- [ ] DECLINE/REFUSE boundary topics
- [ ] Error handling for API failures (or HTTP node error handling)
- [ ] Confirmation before destructive actions
- [ ] Multi-turn escape paths ("cancel", "start over")
- [ ] Escalation path to human
- [ ] Disambiguation topic for overlapping intents
- [ ] Bite-size reusable topics (avoid large monolithic topics)
- [ ] Entity-based topic consolidation (reduce duplication)
- [ ] Performance: cache variables, minimize API calls per turn
- [ ] Clear topic/tool descriptions for generative orchestration routing
- [ ] No periods in topic names (breaks solution export)
- [ ] Consider activity maps for debugging (Jan 2026 preview)
- [ ] Batch-test prompts before deploying (Preview — Test hub)
