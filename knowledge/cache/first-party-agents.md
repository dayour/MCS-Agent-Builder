<!-- CACHE METADATA
last_verified: 2026-04-07
sources: [MS Learn (agents-overview, researcher-agent, wordexcelppt-agents, explore-prebuilt-agents training, agent-registry, learning-agent-overview, sales-research-agent, copilot-release-notes, whats-new), Microsoft 365 Blog (2025-03-25, 2025-06-02, 2025-11-18, 2026-03-09), adoption.microsoft.com/ai-agents, support.microsoft.com (researcher-computer-use, workflows-frontier), Dynamics 365 Blog (2026-03-09, 2026-03-18), TechCommunity (people-skills-expansion-4497646, ess-agent-ga-4469413, planner-agent-rename-MC1250279), WebSearch Apr 2026]
confidence: high
refresh_trigger: before_research
-->
# Microsoft First-Party Agents — Inventory

> Use this inventory during `/mcs-research` to match customer capabilities against existing agents.
> If a first-party agent covers 70%+ of a capability, recommend it instead of building.

## How to Use This File

1. During research, list each customer capability
2. For each capability, check the **Capability Match Patterns** column below
3. **Check license prerequisites** — verify the customer has the required license before recommending
4. If a match is found, record it in `brief.json` → `architecture.frontierAgentMatch[]`
5. Recommend the first-party agent for matched capabilities; build custom agent (CA) only for gaps

**Terminology:** DA = Declarative Agent (M365 Copilot-hosted, config-only). CA = Custom Agent (built in Copilot Studio with full orchestration).

## License Prerequisites

| License | What It Unlocks |
|---------|----------------|
| **M365 Copilot** ($30/user/month) | All first-party agents, DA hosting, Agent Store access |
| **M365 Copilot Chat** (free) | Prebuilt chat agents only (coaches, Visual Creator) |
| **Frontier Program** (enrollment required) | Early access to People, Workforce Insights, Learning agents |
| **Agent 365** ($15/user/month, **GA May 1, 2026**) | Agent Registry, Entra Agent Identity, governance controls. Confirmed GA date per [Mar 2026 Partner Center](https://learn.microsoft.com/en-us/partner-center/announcements/2026-march). |
| **M365 E7** ($99/user/month, **GA May 2026**) | Bundles E5 + Copilot + Entra Suite + Agent 365 |
| **Anthropic subprocessor** (admin toggle) | Word, Excel, PowerPoint creation agents |
| **People Skills** (M365 E3/E5+) | AI-inferred skills on profile cards (180-day refresh for E3/E5; 30-day for Copilot/Viva users). Replaces Skills Agent functionality. |

---

## Tier 1: Frontier Reasoning Agents

Deep reasoning agents with specialized models. 25 queries/month combined limit per user. **Note:** Researcher and Analyst are part of the core Copilot chat experience (available under "Tools") and do NOT fall under agent-related governance settings -- they coexist with agents but are managed separately.

### Researcher
- **Status:** GA (July 2025)
- **License:** M365 Copilot
- **Model:** OpenAI deep research model
- **Location:** M365 Copilot Chat
- **What it does:** Multi-step research across web + work data (emails, meetings, files, chats). Produces structured, cited reports with visuals, charts, and graphs. Takes 5-45 minutes per query. Supports third-party data via Copilot connectors (Salesforce, ServiceNow, Confluence, Jira). Supports multi-agent workflows: can call other connected DAs to accomplish work (Jan 2026 release).
- **Researcher with Computer Use (Frontier Preview):** Extension that lets Researcher interact with public, gated, and interactive web content through a secure Windows 365 virtual machine. Can browse restricted websites, sign in to verified sources, run code/scripts, and create research materials (reports, presentations, spreadsheets). Configurable via M365 Admin Center > Agents > Researcher > Computer Use tab.
- **Capability match patterns:**
  - "Research [topic] and summarize findings"
  - "Analyze competitor landscape"
  - "Compile information from multiple sources"
  - "Create a research report on [topic]"
  - "Synthesize web research with internal documents"
  - "Research content behind login/paywall" (Computer Use)
- **What it CANNOT do:** Real-time queries, sub-minute responses, write to external systems, custom output formats, proactive/scheduled execution
- **When to recommend:** Use case is primarily open-ended research synthesis across web + work data
- **When to build CA instead:** Need custom data sources not in M365/connectors, need specific output format (adaptive cards, structured data), need real-time responses, need to write back to systems

### Analyst
- **Status:** GA (July 2025)
- **License:** M365 Copilot
- **Model:** OpenAI o3-mini reasoning model
- **Location:** M365 Copilot Chat
- **What it does:** Data scientist-like analysis. Accepts Excel/CSV data, calculates statistics, identifies trends, produces reports with charts/visualizations. Runs Python code. Chain-of-thought reasoning with iterative refinement.
- **Capability match patterns:**
  - "Analyze this data and find trends"
  - "Create charts/visualizations from spreadsheet"
  - "Statistical analysis of [dataset]"
  - "Compare data across multiple files"
  - "Build a financial model from this data"
- **What it CANNOT do:** Connect to live databases, real-time data streams, write results back to source systems, scheduled/automated analysis
- **When to recommend:** Use case is primarily data analysis from files the user can upload or reference
- **When to build CA instead:** Need live database queries, need to write results to systems, need scheduled/automated analysis, need domain-specific analysis logic

---

## Tier 2: Office Creation Agents

Create full Office documents from prompts. Grounded in work data via Work IQ.

### Word Agent
- **Status:** GA (rolling out 2026)
- **License:** M365 Copilot + Anthropic subprocessor enabled by admin
- **Model:** Anthropic Claude
- **Location:** M365 Copilot Chat
- **Prerequisite check:** Admin must enable Anthropic as a subprocessor in M365 admin center. Verify before recommending.
- **What it does:** Creates full Word documents from natural language prompts. Grounded in organizational data. Saves to OneDrive.
- **Capability match patterns:**
  - "Generate a [report/proposal/memo] document"
  - "Draft a [policy/procedure/guide] based on [context]"
  - "Create a document summarizing [topic]"
- **When to build CA instead:** Need structured data extraction, need interactive Q&A, need workflow integration

### Excel Agent
- **Status:** GA (rolling out 2026)
- **License:** M365 Copilot + Anthropic subprocessor enabled by admin
- **Model:** Anthropic Claude
- **Location:** M365 Copilot Chat
- **Prerequisite check:** Admin must enable Anthropic as a subprocessor in M365 admin center. Verify before recommending.
- **What it does:** Creates spreadsheets with data analysis, formulas, charts from prompts.
- **Capability match patterns:**
  - "Create a spreadsheet tracking [items]"
  - "Build a budget/forecast template"
  - "Organize this data into a structured spreadsheet"
- **When to build CA instead:** Need live data connections, need automated data refresh, need complex business logic

### PowerPoint Agent
- **Status:** GA (rolling out 2026)
- **License:** M365 Copilot + Anthropic subprocessor enabled by admin
- **Model:** Anthropic Claude
- **Location:** M365 Copilot Chat
- **Prerequisite check:** Admin must enable Anthropic as a subprocessor in M365 admin center. Verify before recommending.
- **What it does:** Creates presentations from prompts, grounded in organizational data.
- **Capability match patterns:**
  - "Create a presentation about [topic]"
  - "Build a slide deck for [meeting/audience]"
  - "Summarize [document] as a presentation"
- **When to build CA instead:** Need branded templates, need data-driven slides from live sources, need interactive content

---

## Tier 3: Prebuilt Chat Agents

Available at no extra cost with M365 Copilot Chat (free) or M365 Copilot.

### Writing Coach
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Writing feedback, tone adjustment, translation, document review
- **Capability match patterns:**
  - "Review and improve my writing"
  - "Adjust tone of this document"
  - "Translate this content"
  - "Provide writing feedback"
- **When to build CA instead:** Need domain-specific style enforcement, need automated document workflows, need integration with content management systems

### Prompt Coach
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Helps craft effective Copilot prompts
- **Capability match patterns:**
  - "Help me write better prompts"
  - "Optimize my Copilot queries"

### Idea Coach
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Facilitates brainstorming, idea generation, planning
- **Capability match patterns:**
  - "Brainstorm ideas for [project]"
  - "Help me plan [initiative]"

### Visual Creator
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Image and visual content generation
- **Capability match patterns:**
  - "Create an image/visual for [purpose]"
  - "Design a graphic for [context]"

### Career Coach
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Personalized career development suggestions
- **Capability match patterns:**
  - "Career development advice"
  - "Skill gap analysis"

### Learning Coach
- **Status:** GA
- **License:** M365 Copilot Chat or M365 Copilot
- **What it does:** Complex topic breakdowns, learning plans, explanations. General-purpose learning assistant.
- **Not to be confused with:** Learning Agent (Frontier) — which provides personalized Copilot usage tips and LinkedIn Learning integration. Learning Coach is free and general; Learning Agent is Frontier-only and Copilot-skills-focused.
- **Capability match patterns:**
  - "Explain [complex topic]"
  - "Create a learning plan for [skill]"

---

## Tier 4: Business-Specific Agents

### Facilitator
- **Status:** GA
- **License:** M365 Copilot
- **Location:** Microsoft Teams meetings
- **What it does:** Drives meeting agenda, takes notes, manages actions, answers questions during meetings, moderates discussion
- **Capability match patterns:**
  - "Meeting notes and action items"
  - "Meeting management and facilitation"
  - "Summarize meeting discussions"
- **When to build CA instead:** Need custom meeting workflows, need integration with external task systems, need post-meeting automation

### Interpreter
- **Status:** GA
- **License:** M365 Copilot
- **Location:** Microsoft Teams meetings
- **What it does:** Real-time speech-to-speech interpretation in Teams meetings. Supports up to 9 languages.
- **Capability match patterns:**
  - "Real-time translation in meetings"
  - "Multi-language meeting support"

### Planner Agent (formerly Project Manager)
- **Status:** **GA** (rolling out mid-Mar 2026, completion expected early May 2026; renamed from "Project Manager" to "Planner Agent" per [MC1250279](https://mc.merill.net/message/MC1250279))
- **License:** M365 Copilot (now available on both Planner premium AND basic plans)
- **Location:** Microsoft Planner
- **What it does:** Automates plan creation, status report generation, task execution in Planner. AI-assisted project tracking with intelligent task suggestions.
- **Name change:** Renamed from "Project Manager" to "Planner Agent" mid-Mar 2026 to align with M365 Copilot branding. No functional or behavioral changes.
- **Capability match patterns:**
  - "Create and manage project plans"
  - "Generate project status reports"
  - "Automate task assignment and tracking"
- **When to build CA instead:** Need integration with non-Planner PM tools (Jira, Azure DevOps, Asana), need custom project workflows

### Employee Self-Service (ESS Agent)
- **Status:** **GA** (announced at Ignite Nov 2025, rolling out in waves; GA confirmed per [TechCommunity](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/announcing-general-availability-of-the-employee-self-service-agent-in-microsoft-/4469413))
- **License:** M365 Copilot
- **What it does:** Centralized HR/IT self-service (leave management, device requests, policy questions). Includes "accelerator packs" with Microsoft-built connectors, starter workflows, and inline agent handoff for common HR and IT scenarios. Configurable and extendable in Copilot Studio.
- **Capability match patterns:**
  - "HR self-service (leave, benefits, policies)"
  - "IT self-service (device requests, access)"
  - "Employee onboarding questions"
  - "Leave balance check and ticket submission"
- **When to build CA instead:** Need integration with specific HR/IT systems (ServiceNow, Workday, SAP SuccessFactors) beyond the included accelerator packs

### Skills Agent
- **Status:** **RETIRED** (removed from agent store Mar 16, 2026; fully retired end of Mar 2026)
- **License:** M365 Copilot
- **What it does:** Find experts, understand skillsets across the organization. Powered by People Skills data layer.
- **Replaced by:** Capabilities integrated into M365 Copilot natively + Workforce Insights Agent (for leaders) + Learning Agent (for employees). Per [TechCommunity announcement](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/people-skills-expanding-skills-intelligence-to-more-users-and-surfaces-across-mi/4497646), "All existing skills capabilities continue to be supported through M365 Copilot and the new Learning and Workforce Insights agents."
- **Capability match patterns:**
  - "Find an expert in [topic]" -- now handled by M365 Copilot natively via People Skills
  - "Who has skills in [area]?" -- now handled by M365 Copilot natively via People Skills

### Sales Development Agent
- **Status:** Frontier Preview
- **License:** M365 Copilot + Dynamics 365 or Salesforce
- **What it does:** Autonomous lead nurturing, qualification, pipeline management, personalized outreach
- **Capability match patterns:**
  - "Lead qualification and nurturing"
  - "Sales pipeline management"
  - "Automated customer outreach"
- **When to build CA instead:** Need custom CRM integration, need custom qualification criteria, non-standard sales process

### Sales Research Agent
- **Status:** Public Preview
- **License:** Dynamics 365 Sales Premium or Dynamics 365 Sales Enterprise
- **Location:** Dynamics 365 Sales
- **What it does:** Gathers information from CRM, web, and configured knowledge sources (battle cards, positioning briefs, product comparisons). Provides stakeholder and competitor intelligence, risk mitigation strategies. Supports Fabric Lakehouse as a data source. Produces visual research blueprints with journey lines and AI cursor interaction.
- **Capability match patterns:**
  - "Research competitor landscape for this opportunity"
  - "Stakeholder intelligence and risk analysis"
  - "Sales data analysis with organizational context"
- **When to build CA instead:** Need non-D365 CRM data, need custom research workflows, need real-time pipeline automation

---

## Tier 5: Frontier Program Agents (Early Access)

Require Frontier program enrollment.

### People Agent
- **Status:** **RETIRED** (retired end of Mar 2026, along with Skills Agent; per [Topedia](https://blog-en.topedia.com/2026/03/microsoft-retires-skills-agent-and-people-agent-in-microsoft-365-copilot/) and [TechCommunity People Skills expansion](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/people-skills-expanding-skills-intelligence-to-more-users-and-surfaces-across-mi/4497646))
- **License:** M365 Copilot + Frontier program
- **What it does:** Prepares meeting context, provides interaction insights, identifies colleagues by skills
- **Replaced by:** People-related capabilities being integrated natively into M365 Copilot Chat. People Skills now appearing on Teams profile cards (Mar 2026). Workforce Insights Agent covers organizational skills analysis for leaders.
- **Capability match patterns:**
  - "Prepare me for a meeting with [person]" -- now handled by M365 Copilot natively
  - "What's my interaction history with [person]?" -- now handled by M365 Copilot natively
  - "Find colleagues with [expertise]" -- now handled by People Skills in M365 Copilot

### Workforce Insights Agent
- **Status:** Frontier Preview
- **License:** M365 Copilot + Frontier program
- **What it does:** Organizational structure analysis, staffing insights, workforce planning support
- **Capability match patterns:**
  - "Organizational structure analysis"
  - "Workforce planning and staffing insights"

### Learning Agent (Frontier)
- **Status:** Frontier Preview (Private Preview)
- **License:** M365 Copilot + Frontier program. Optional: Viva Suite / Viva Premium (enables Viva Learning capabilities)
- **Supported platforms:** M365 Copilot Web, M365 Copilot Chat Native App, Teams (Web and App). NOT supported in Word, PowerPoint, or Excel App Copilot.
- **Deployment:** Admins deploy via M365 Admin Center > Agents page > search "Learning (Frontier)". Users find in Agent Store > Built by Microsoft > "Learning (Frontier)". Users in Frontier must also be enabled for Learning agent.
- **What it does:** Personalized Copilot usage tips, skill-based learning recommendations, curated learning paths, AI-powered role-play exercises via LinkedIn Learning. Focused on Copilot adoption and skill development.
- **Not to be confused with:** Learning Coach (Tier 3) — which is a free, general-purpose topic explainer. This agent is Frontier-only and specifically focused on Copilot skills and LinkedIn Learning.
- **Capability match patterns:**
  - "Personalized learning recommendations"
  - "Copilot usage training and tips"
  - "Role-play practice exercises"

### Copilot Cowork
- **Status:** Frontier (available Mar 30, 2026 per [Microsoft 365 Blog](https://www.microsoft.com/en-us/microsoft-365/blog/2026/03/30/copilot-cowork-now-available-in-frontier/))
- **License:** M365 Copilot + Frontier program
- **Location:** M365 Copilot Chat (Researcher)
- **What it does:** Multi-model collaboration feature -- GPT drafts a response to a research query, Claude reviews it for accuracy, completeness, and citation quality before the response is given to the user. Combines OpenAI and Anthropic models in sequence for higher-quality research output.
- **Capability match patterns:**
  - "Research [topic] with extra quality assurance"
  - "Get a peer-reviewed research summary"
- **Note:** This is a Researcher enhancement, not a standalone agent. It extends the existing Researcher with multi-model critique capabilities.

### Workflows Agent
- **Status:** Frontier Early Access (rolling out, US + English only)
- **License:** M365 Copilot + Frontier program (currently M365 Personal, Family, Premium)
- **Location:** M365 Copilot Chat
- **What it does:** Automates work across M365 using natural language. Generates working workflows from descriptions. Supports Outlook, SharePoint, Teams, Planner, Approvals, Office 365 Users, Dataverse. Trigger-based (schedule, event) and action-based (send emails, post Teams messages, create SharePoint items). Collects user input with adaptive cards in Teams. Visual designer for testing and management.
- **Limitations:** Cannot share workflows; experimental and subject to change; US/English only currently
- **Capability match patterns:**
  - "Automate this recurring task across M365 apps"
  - "Create a workflow triggered by [event]"
  - "Set up an approval process in Teams"
- **When to build CA instead:** Need complex multi-system automation, need shared/team workflows, need non-M365 integrations, need production-grade reliability

---

## Agents in Channels & Communities

### Agents in Channels
- **Status:** Public Preview
- **License:** M365 Copilot
- **Location:** Microsoft Teams channels
- **What it does:** Channel experts grounded in channel conversations and meetings. Summarizes discussions, answers questions about channel history.
- **Capability match patterns:**
  - "What was discussed about [topic] in this channel?"
  - "Summarize recent channel activity"

### Agents in Communities
- **Status:** Public Preview
- **License:** M365 Copilot
- **Location:** Microsoft Viva Engage
- **What it does:** Accelerates community knowledge sharing, surfaces expertise
- **Capability match patterns:**
  - "Community knowledge base Q&A"
  - "Surface expertise within community"

---

## Quick Reference: Capability Routing Table

| Customer Need | First-Party Agent | Coverage | Build CA For |
|--------------|-------------------|----------|-------------|
| Deep web + work research | Researcher | High | Custom data sources, real-time needs |
| Research behind logins/paywalls | Researcher + Computer Use (Frontier) | High | Non-web gated content |
| Data analysis from files | Analyst | High | Live database queries, automated pipelines |
| Document generation | Word/Excel/PPT Agents | Medium | Branded templates, data-driven content |
| Meeting management | Facilitator | High | Custom workflows, external integrations |
| Translation | Interpreter | High | Rare — only if custom terminology needed |
| Project management | Planner Agent (GA) | Medium-High | Non-Planner tools, custom workflows |
| HR/IT self-service | Employee Self-Service (GA) | Medium-High | Specific ITSM/HR system integrations beyond accelerator packs |
| Expert finding | ~~Skills Agent~~ **RETIRED** -- use M365 Copilot + People Skills natively | Medium | Custom skills taxonomy, external directories |
| Sales pipeline | Sales Development | Medium | Custom CRM, non-standard processes |
| Sales research + competitor intel | Sales Research Agent | Medium | Non-D365 CRM, custom research flows |
| Writing improvement | Writing Coach | High | Domain-specific style guides |
| Brainstorming | Idea Coach | Medium | Domain-specific ideation frameworks |
| M365 workflow automation | Workflows (Frontier) | Medium | Complex multi-system automation, shared workflows |
| Workforce/skills intelligence (leaders) | Workforce Insights (Frontier) | Medium | Custom workforce analytics, non-M365 data |

---

## Sources

- [Agents for Microsoft 365 Copilot](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/agents-overview)
- [Get started with Researcher](https://learn.microsoft.com/en-us/copilot/microsoft-365/researcher-agent)
- [Researcher with Computer Use (Frontier)](https://support.microsoft.com/en-us/topic/get-started-using-researcher-with-computer-use-in-microsoft-365-copilot-frontier-1f274537-6648-46e8-8264-052a49b92af4)
- [Agent Registry in M365 Admin Center](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/agent-registry)
- [Word, Excel, and PowerPoint Agents](https://learn.microsoft.com/en-us/copilot/microsoft-365/wordexcelppt-agents)
- [Explore Prebuilt Agents (Training)](https://learn.microsoft.com/en-us/training/modules/explore-prebuilt-microsoft-365-copilot-agents/)
- [Introducing Researcher and Analyst](https://www.microsoft.com/en-us/microsoft-365/blog/2025/03/25/introducing-researcher-and-analyst-in-microsoft-365-copilot/)
- [Researcher and Analyst GA](https://www.microsoft.com/en-us/microsoft-365/blog/2025/06/02/researcher-and-analyst-are-now-generally-available-in-microsoft-365-copilot/)
- [Ignite 2025: Frontier Firm](https://www.microsoft.com/en-us/microsoft-365/blog/2025/11/18/microsoft-ignite-2025-copilot-and-agents-built-to-power-the-frontier-firm/)
- [Wave 3: Frontier Transformation](https://www.microsoft.com/en-us/microsoft-365/blog/2026/03/09/powering-frontier-transformation-with-copilot-and-agents/)
- [Agents in Microsoft 365](https://adoption.microsoft.com/en-us/ai-agents/agents-in-microsoft-365/)
- [Frontier Program](https://adoption.microsoft.com/en-us/copilot/frontier-program/)
- [Learning Agent Setup](https://learn.microsoft.com/en-us/viva/learning/learning-agent-overview-deployment-steps)
- [Workflows in M365 Copilot (Frontier)](https://support.microsoft.com/en-us/topic/get-started-with-workflows-in-microsoft-365-copilot-frontier-8c6aba25-db31-443d-8319-bc79747b280a)
- [Sales Research Agent](https://learn.microsoft.com/en-us/dynamics365/sales/use-sales-research-agent)
- [M365 Copilot Release Notes](https://learn.microsoft.com/en-us/copilot/microsoft-365/release-notes)
- [Microsoft Agent 365](https://www.microsoft.com/en-us/microsoft-agent-365)
- [Manage Copilot Agents in M365 Admin](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-copilot-agents-integrated-apps)
- [People Skills: Expanding skills intelligence](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/people-skills-expanding-skills-intelligence-to-more-users-and-surfaces-across-mi/4497646)
- [Employee Self-Service Agent GA](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/announcing-general-availability-of-the-employee-self-service-agent-in-microsoft-/4469413)
- [Planner Agent rename MC1250279](https://mc.merill.net/message/MC1250279)
- [Copilot Cowork in Frontier](https://www.microsoft.com/en-us/microsoft-365/blog/2026/03/30/copilot-cowork-now-available-in-frontier/)
- [Agent Evaluation GA](https://techcommunity.microsoft.com/blog/copilot-studio-blog/agent-evaluation-in-microsoft-copilot-studio-is-now-generally-available/4507392)
