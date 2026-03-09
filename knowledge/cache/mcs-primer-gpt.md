<!-- CACHE METADATA
last_verified: 2026-03-09
sources: [CLAUDE.md, knowledge/cache/*.md (synthesized)]
confidence: high
refresh_trigger: manual
-->
# Microsoft Copilot Studio (MCS) — Domain Primer

## What Is MCS?

Microsoft Copilot Studio is a low-code platform for building AI agents (chatbots) that integrate with Microsoft 365, Power Platform, and external systems. Agents are deployed to channels (Teams, Web, Slack, etc.) and can be published to production environments.

## Core Concepts

**Generative Orchestration**: An LLM-driven planner interprets user intent, selects tools/topics/knowledge sources, executes multi-step plans, and synthesizes responses. This is the default and required mode for all modern agents.

**Topics**: Conversation flows authored in YAML. Each has a trigger (phrases, events, or "by agent" for generative routing) and nodes (messages, questions, conditions, actions). Topics are the building blocks of agent behavior.

**Triggers**: How topics activate. Types: phrases (NLU match), "by agent" (generative orchestration routes to it), on conversation start, on error, before/after generative response. Phrase triggers use NLU matching, not exact match.

**Tools**: External capabilities the agent can call — MCP servers (Microsoft 365, SharePoint, etc.), Power Automate flows, connectors, HTTP actions. Referenced in instructions as `/ToolName`.

**Knowledge Sources**: Documents, URLs, SharePoint sites, or Dataverse tables the agent searches for grounded answers. Configured separately from instructions.

**Instructions**: Natural language guidance (max 8,000 chars) that tells the agent HOW to behave — persona, boundaries, tool usage patterns, response formatting. Instructions influence response generation and disambiguation more than routing. Tool/topic DESCRIPTIONS matter most for routing.

## Key Constraints

- Agent instructions: 8,000 character limit
- Routing priority: Description > Name > Parameters > Instructions
- 3 eval sets: safety (100% pass), functional (85%), resilience (80%)
- `/Tool` and `/Topic` syntax references tools/topics in instructions
- Generative orchestration is REQUIRED for MCP tools, knowledge grounding, and AI routing
- Topics can't call MCP servers directly — only generative orchestration can
- Adaptive cards in Teams: max 28KB, version 1.5, no Action.Execute

## brief.json Structure

The `brief.json` file is the single source of truth for an agent build:
- `agentName`, `purpose`, `persona` — identity
- `capabilities[]` — what the agent does (customer-facing features)
- `integrations[]` — tools and connectors configured
- `knowledge[]` — knowledge sources for grounding
- `conversations.topics[]` — topic definitions with triggers and nodes
- `boundaries` — what the agent should NOT do (handle/decline/refuse)
- `instructions` — the agent's system prompt text
- `evalSets[]` — test suites (safety, functional, resilience) with per-test results
- `decisions[]` — structured choice points with ranked options
- `architecture` — single-agent or multi-agent design
- `model` — which LLM powers the agent (GPT-4o, GPT-4o-mini, etc.)

## Eval Methods (7 Total)

| Method | Type | What It Does |
|--------|------|-------------|
| General quality | Heuristic | Relevance + completeness check |
| Compare meaning | Scored 0-100 | Semantic similarity (same meaning, different words OK) |
| Keyword match | All/Any mode | Checks for specific words/phrases |
| Text similarity | Scored 0-100 | Token-level text closeness |
| Exact match | Binary | Must match exactly |
| Capability use | Binary | Checks if specific tools/topics were used |
| Plan validation | Scored 0-100 | Verifies tool invocations (custom) |
