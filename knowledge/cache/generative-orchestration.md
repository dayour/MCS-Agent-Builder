<!-- CACHE METADATA
last_verified: 2026-03-23
sources: [MS Learn advanced-generative-actions, MS Learn guidance/generative-orchestration, MS Learn guidance/generative-mode-guidance, MS Learn whats-new, MS Learn faqs-generative-orchestration, MCS UI, community blogs, WebSearch Mar 2026, MS Learn MCP Mar 2026, 2026 Wave 1 release plan, MS Learn guidance hub]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Generative Orchestration — Quick Reference

## How It Works

LLM-driven planner: interprets intent → selects tools/topics/knowledge/agents → executes multi-step plans → synthesizes response. Default for all new agents.

**ALWAYS use generative orchestration. Never use classic.** Generative orchestration is required for MCP tools, knowledge grounding, AI routing, and multi-step planning. Classic orchestration is legacy and does not support modern MCS features. Set via `bot.configuration`: `"settings": { "GenerativeActionsEnabled": true }`. Our build pipeline sets this on every agent at creation time AND in the settings configuration step.

**Routing priority**: Description (most important) > Name > Input/output parameters > Agent instructions

## Architecture Components (from MS Learn guidance hub, Mar 2026)

| Component | Role |
|-----------|------|
| **Orchestrator (planner)** | LLM brain: turns input into structured plan, identifies intents, chooses tools/topics/agents, defines sequence and data flow |
| **Knowledge layer** | Read-only retrieval sources (KB, docs, databases) — provides evidence/context with citations |
| **Tools and connectors** | External actions/APIs/flows with defined interfaces (input params, output vars, error conditions) — agent's "skills" |
| **Topics and inline agents** | Reusable conversation paths; invoked by description match (not just trigger phrases) |
| **Event triggers (autonomy)** | Start orchestrator without user message (scheduled/event-based); each trigger has own conditions and instructions |

Source: [Apply generative orchestration capabilities](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration)

## Requirements for Key Features

| Feature | Requires Generative Orchestration? |
|---------|-----------------------------------|
| MCP server usage | **Yes** — topics cannot call MCP servers directly |
| "A plan completes" trigger | **Yes** — generative orchestration only |
| "AI-generated response about to be sent" trigger | **Yes** — generative orchestration only |
| Autonomous tool selection | **Yes** |
| Knowledge proactive search | **Yes** |

## Limits

| Constraint | Value |
|-----------|-------|
| Conversation history considered | **Last 10 turns** (limited — agent may lose earlier context) |
| Messages per topic/action chain | **5 per turn** |
| Topics per agent | **1,000 max** (Dataverse envs); **250** (Dataverse for Teams) |
| Skills per agent | **100 max** |
| Trigger phrases per topic | **200 max** |
| Consecutive actions (recommended) | **< 15** |
| Performance degradation | **> 30-40 choices** → split into connected agents |
| Instructions length | **8,000 characters** |
| RPM quota (generative AI messages) | **50-100+ RPM** depending on message packs (see limits-licensing.md) |

## Classic vs Generative

| Behavior | Generative | Classic |
|----------|-----------|---------|
| Topic selection | **Description**-based | **Trigger phrase** matching |
| Child/connected agents | Selected by **description** | Not applicable |
| Tools | Autonomously chosen | Explicitly called from topics |
| Knowledge | Proactively searched | Fallback only (or explicit generative answers node) |
| Multi-intent | Handles multiple intents in one utterance | Single topic per utterance |
| Missing inputs | Auto-generates questions from input names/descriptions | Must use Question nodes |
| Responses | Auto-generated from all outputs | Must use Message nodes |
| Disambiguation | Planner handles internally | Multiple Topics Matched topic |

## System Topics in Generative Mode

| Topic | Behavior |
|-------|----------|
| Conversation Start | Works. In Teams: runs ONCE per user install. |
| Conversational Boosting | **NOT used** — knowledge searched proactively |
| Multiple Topics Matched | **NOT currently called** (known limitation) |
| Fallback / Escalate / On Error / Sign in | Work normally |

## Three Special Triggers (Generative Orchestration Only)

| Trigger | Fires When | Key Detail |
|---------|-----------|------------|
| **On Knowledge Requested** | Before knowledge search | YAML-only (name topic exactly `OnKnowledgeRequested`). Read `SearchPhrase`. |
| **AI Response Generated** (`OnGeneratedResponse`) | After AI drafts, before sending | Access `Response.FormattedText`. Set `ContinueResponse = false` to suppress. |
| **On Plan Complete** (`OnPlanComplete`) | After plan executes all steps | Cleanup, surveys, end logic. |

## Knowledge in Generative Mode

- Planner proactively searches — Conversational Boosting NOT used (and any modifications to that system topic are ignored)
- **> 25 knowledge sources** → internal GPT filters by descriptions
- Uploaded files exempt from 25-source limit
- **"Official Sources" NOT compatible** with generative orchestration
- **"Use general knowledge" OFF** → follow-up questions suppressed (orchestrator considers ungrounded clarifying questions as ungrounded; agent defaults to "I'm sorry, I'm not sure how to help with that")
- Custom data / Bing Custom Search must be in topic generative answers nodes
- Classic data sources configured in generative answers nodes also NOT used with generative orchestration
- Hyperlinks from knowledge sources (Word/PDF/web) appear as **plain text** in responses (known limitation)
- Custom entity inputs NOT yet supported for tools/topics — use Question node as workaround
- **Cannot force specific knowledge articles on demand** — AI chooses relevant articles based on query
- For generative orchestration to search **specific** knowledge sources, incorporate them into a generative answers node in a topic; otherwise it searches all agent-level knowledge sources
- **SharePoint lists as knowledge source** — Preview Apr 2026, GA May 2026 (planned)
- **Up to 1,000 files per agent** for SharePoint/OneDrive uploads (GA Oct 2025)

## Multi-Agent

- Connected agents treated as tools — selected by **description**
- Conversation history passed by default (toggleable)
- **Multi-level chaining NOT supported** (connected agent can't have its own connected agents)
- Connected agents enable modularity and can **bypass plan limits**
- Types: MCS (GA), Foundry/Fabric/SDK/A2A (preview)
- **Nov 2025 GA:** Orchestrate multiple agents to break down complex tasks across specialized agents. Link to agents within your environment or external sources like Microsoft Fabric data agents.
- **New (2026 Wave 1):** "Create agents optimized for M365 and M365 Copilot users" — preview Jun 2026. "Evaluate agents for M365 Copilot in Copilot Studio" — preview Jul 2026.
- **Copy agents from M365 Copilot to Copilot Studio** (Nov 2025 GA): Move agents created in M365 Copilot into Copilot Studio for advanced capabilities.
- **Component collections** with new enhancements (Nov 2025): Access from sidebar, export/import, support for primary agents and new connector types including child agents and MCP.

## Best Practices (from official guidance, updated Mar 2026)

- **Routing priority**: Description (most important) > Name > Input/output parameters > Agent instructions
- Use **active voice, present tense** for descriptions ("This tool provides..." not "Weather info is provided by...")
- Avoid overlapping descriptions — test and revise if agent invokes multiple similar topics
- Return topic results as **output variables** (not message nodes) — lets orchestrator compose contextual responses
- Avoid "double-handling" data — don't feed outputs back into LLM as open-ended context
- Use **Clear variable values** node with "Conversation history for current session" to reset context
- Use **End all topics** node to cancel remaining planned steps
- **Auto-prompting**: In generative mode, the agent generates questions on its own for missing inputs. Make input names human-friendly ("start date", "email address") so AI forms natural questions. If AI-generated question is suboptimal, refine input's description or name.
- **Negative routing in descriptions**: Include "It doesn't get [X]" or "Do NOT use for [Y]" to prevent ambiguous routing
- Use **Power Fx validation formulas** on inputs to ensure valid data (e.g., restricting country code to two letters)
- **Topic names must not contain periods (`.`)** — exporting a solution with periods in topic names will fail
- **Trust the planner, within reason**: Let the orchestrator mix and match tools/knowledge. It may combine knowledge articles with API calls for superior answers.
- **Provide example utterances carefully**: Add 1-2 example queries in topic descriptions to help the LLM understand when to use that topic. Keep descriptions succinct.

## Controlling Generative Orchestration

| Control | Mechanism |
|---------|-----------|
| Cancel plan mid-execution | **End all topics** node |
| Clear conversation memory | **Clear variable values** → "Conversation history for current session" |
| Post-response hook | **AI Response Generated** trigger (`OnGeneratedResponse`) |
| Post-plan hook | **On Plan Complete** trigger (`OnPlanComplete`) |
| Pre-knowledge hook | **On Knowledge Requested** trigger (YAML-only) |
| Switch to classic | Settings > Generative AI > Orchestration → No |

## Models (Mar 2026)

GPT-4o **retired** (all commercial regions, Oct 2025). **GPT-4.1** is the default.

| Model | Category | Status | Notes |
|-------|----------|--------|-------|
| GPT-4.1 | General | **Default (GA)** | All regions |
| GPT-5 Chat | General | **GA** (EU + US); Preview elsewhere | Cross-geo in non-GA regions |
| GPT-5 Reasoning | Deep | **Preview** | Cross-geo outside EU/US |
| GPT-5 Auto | Auto | **Preview** | Routes dynamically per query |
| GPT-5.2 Chat | General | **Experimental** | Cross-geo |
| GPT-5.2 Reasoning | Deep | **Experimental** | Cross-geo |
| Claude Sonnet 4.5 | General | **Preview** | Cross-geo, external model (admin opt-in). Also available for Computer Use and Prompt Builder. |
| Claude Sonnet 4.6 | General | **Experimental** | Cross-geo, external model |
| Claude Opus 4.6 | Deep | **Experimental** | Cross-geo, external model. Also available in Prompt Builder. |
| Grok 4.1 Fast | General | **Experimental** | **US only**, external model (admin opt-in, xAI), safety caveats |

GCC/GCCHigh/DoD: still GPT-4o only (Default).
Generative orchestration available for all supported languages (GA for multi-language support since Jun 2025).

**Prompt Builder model selection (Feb 2026):** Claude Opus 4.6 and Claude Sonnet 4.5 now selectable per-prompt in Prompt Builder for fine-grained control over reasoning depth, quality, latency, and cost.

## Generative AI Settings

| Setting | Default |
|---------|---------|
| Orchestration | Generative |
| Content moderation | High (5 levels: Lowest→Highest) |
| General knowledge | On |
| Web search (Bing) | Off |
| Tenant graph grounding | Off (needs M365 Copilot license) |
| Deep reasoning | Off (opt-in) |

## Recent Enhancements (Jun 2025 - Mar 2026)

| Feature | Date | Status | Details |
|---------|------|--------|---------|
| Work IQ MCP tools | Mar 2026 | **Preview** | Connect agents to Work IQ for M365 work insights |
| Improved Graph connector responses | Feb 2026 | **GA** | Better retrieval for ServiceNow tickets and Azure DevOps work items |
| Claude Sonnet 4.5 for Computer Use | Feb 2026 | **GA** | Improved nuanced decision-making for complex CUA tasks |
| Prompt builder enhancements | Feb 2026 | **GA** | Content moderation per prompt, Claude models, inline editing |
| Eval enhancements (thumbs up/down, activity maps, CSV import) | Jan 2026 | **Preview** | Real-time feedback, runtime activity maps, CSV template for test sets |
| VS Code extension | Jan 2026 | **GA** | Build/edit/manage agents in VS Code (advanced developer workflows) |
| Eval test sets (customizable) | Oct 2025 | **Preview** | Upload, manually create, or AI-generate test sets with graders |
| Tool groups | Nov 2025 | **Preview** | Curated sets of tools from Outlook/SharePoint connectors in one step |
| Themes analytics | Oct 2025 | **Preview** | Group user questions into themes for pattern analysis |
| SharePoint metadata filters | Nov 2025 | **GA** | Filter by filename, owner, modified date for retrieval |
| Tenant graph grounding improvements | Nov 2025 | **GA** | Updated architecture + new retrieval methods for SharePoint |
| File collections as knowledge source | Aug 2025 | **GA** | Group related files with variable-based instructions |
| Knowledge source analytics | Jun 2025+ | **GA** | See how autonomous agents used knowledge during runs |
| File/image upload for analysis | Aug 2025 | **GA** | Users upload files/images; agent analyzes and passes to downstream systems |
| Code interpreter | Aug 2025 | **GA** | Generate Python code-based actions from natural language in prompt builder and agent workflows |
| Computer Use agents | Sep 2025 | **Preview** | Automate desktop tasks on Windows using vision and reasoning |
| Client SDK (native apps) | Sep 2025 | **GA** | Embed agents in Android/iOS/Windows apps for multimodal conversations |
| Advanced NLU customization | Jul 2025 | **GA** | Define topics and entities using own data for higher accuracy (esp. D365) |
| MIP sensitivity labels | Jul 2025 | **Preview** | Display Purview labels across connectors, test chat, Teams, M365 Copilot |

Source: [What's new in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new)
