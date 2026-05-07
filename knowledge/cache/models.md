<!-- CACHE METADATA
last_verified: 2026-04-27
sources: [MS Learn (authoring-select-agent-model [last-modified 2026-04-25], prompt-model-settings, prompt-model-availability, planned-features, bring-your-own-model-prompts, authoring-select-external-response-model, nlu-preview-model, release-plan/2026wave1, release-plan/2025wave2/change-history, whats-new, system-service-card-copilot-studio), MCS UI snapshot, WebSearch Apr 2026, TechCommunity (Claude Opus 4.7 in M365 Copilot Apr 16 2026), GitHub Changelog (Claude Opus 4.7 GA Apr 16 2026)]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Available Models

## Models Available in MCS (Apr 2026)

### Model Categories

| Category | Purpose | Examples |
|----------|---------|---------|
| **General** | Everyday chat, FAQ, routing | GPT-4.1, GPT-5 Chat, Claude Sonnet 4.5, Claude Sonnet 4.6 |
| **Deep** | Complex reasoning, multi-step analysis | GPT-5 Reasoning, Claude Opus 4.6, Claude Opus 4.7 (Experimental), GPT-5.4 Reasoning |
| **Auto** | Mixed workloads -- routes dynamically between general and reasoning | GPT-5 Auto |
| **Mini** | Cost-effective, moderate complexity | GPT-4.1 mini (prompt builder only) |

### Primary Agent Model Lineup (agent orchestration)

Source: [MS Learn authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model)

| Model | Category | Status | Availability | Notes |
|-------|----------|--------|-------------|-------|
| GPT-4o | General | **RETIRED** | All regions | Replaced by GPT-4.1 (Oct 2025). 1-month grace period expired. |
| **GPT-4.1** | General | **GA (Default)** | All regions | Default model for all new agents |
| **GPT-5 Chat** | General | **GA (Global)** | All regions | Standard rate. GA globally since Mar 2026 (previously EU + US only as of Nov 2025). "ChatGPT-5 is now generally available globally" per [What's New Mar 2026](https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new). |
| **GPT-5 Reasoning** | Deep | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Premium rate, 400K context |
| **GPT-5 Auto** | Auto | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Dynamically routes between general and reasoning |
| GPT-5.3 Chat | General | **Experimental** | **US only** (early access environment) | Next-gen general. Replaced GPT-5.2 Chat in model table. |
| GPT-5.4 Reasoning | Deep | **Experimental** | **US only** (early access environment) | Next-gen reasoning. Replaced GPT-5.2 Reasoning in model table. |
| **GPT-5.5 Reasoning** | Deep | **Experimental** | **US only** (early access environment) | New as of Apr 25, 2026 doc refresh. Latest experimental reasoning model. Source: [authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model). |
| **Claude Sonnet 4.5** | General | **GA (Global)** | GA (cross-geo) all regions; GA natively in US | Anthropic model, requires admin enablement. GA globally since Mar 2026 per [What's New](https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new). Also available for Computer Use agents (Feb 2026). |
| **Claude Sonnet 4.6** | General | **GA (Global)** | GA (cross-geo) all regions; GA natively in US | Anthropic model. GA globally since Mar 2026 per [What's New](https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new). |
| **Claude Opus 4.6** | Deep | **GA (Global)** | GA (cross-geo) all regions; GA natively in US | Anthropic deep reasoning. GA globally since Mar 2026. Also available in prompt builder (Feb 2026). |
| **Claude Opus 4.7** | Deep | **Experimental** | Experimental (cross-geo) in all regions incl. US | Anthropic next-gen deep reasoning. Landed in MCS model selector Apr 16, 2026 (same day GitHub Copilot / M365 Copilot rollout). First Claude model with high-resolution image support. Improved long-horizon agentic work, knowledge tasks, vision, memory. Requires admin enablement (experimental + external models + cross-geo). NOT for production. Source: [authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model), [Anthropic blog](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/available-today-anthropic-claude-opus-4-7-in-microsoft-365-copilot/4511666). |
| Grok 4.1 Fast | General | **Experimental** | **US only** (early access environment) | xAI model. Higher harmful content risk per MS safety eval. Non-reasoning. |

### Prompt Builder Model Lineup (AI Builder prompts in MCS / Power Apps / Power Automate)

Source: [MS Learn prompt-model-settings](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-settings)

| Model | Category | Licensing | Context | Notes |
|-------|----------|-----------|---------|-------|
| **GPT-4.1 mini** | Mini | Basic rate | 128K | Default for prompt builder |
| **GPT-4.1** | General | Standard rate | 128K | |
| **GPT-5 chat** | General | Standard rate | 128K | GA |
| **GPT-5 reasoning** | Deep | Premium rate | 400K | GA (all regions via cross-geo) |
| GPT-5.2 chat | General | Standard rate | 128K | Experimental (US only) |
| GPT-5.2 reasoning | Deep | Premium rate | 400K | Experimental (US only) |
| Claude Sonnet 4.5 | General | Standard rate | 200K | Experimental (note: GA for agent orchestration, but experimental for prompt builder) |
| Claude Opus 4.5 | Deep | Premium rate | 200K | Experimental |

**Retired models (prompt builder):** Claude Opus 4.1 (retired Feb 2026, replaced by Claude Opus 4.5), o3 (retired Dec 2025, replaced by GPT-5 reasoning), GPT-4o mini/GPT-4o (retired Jul 2025).

**Note:** Prompt builder has a DIFFERENT model lineup and status from agent orchestration. Claude models are "experimental" in prompt builder but "GA" in agent orchestration. GPT-5.2 is still listed in prompt builder but replaced by GPT-5.3/5.4 in agent orchestration. Claude Sonnet 4.5 / Opus 4.5 in prompt builder are unavailable in Asia region but experimental everywhere else (per [prompt-model-availability](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-availability)). GPT-5 reasoning is now fully GA in the prompt builder across all regions (via cross-geo where needed).

### Bring Your Own Model (BYOM) -- GA for prompts, Preview for response generation (Mar 2026)

Source: [MS Learn bring-your-own-model-prompts](https://learn.microsoft.com/en-us/microsoft-copilot-studio/bring-your-own-model-prompts), [MS Learn release plan](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave2/microsoft-copilot-studio/use-own-model-when-generating-responses)

- **GA for prompts:** Connect Azure AI Foundry models into agent prompts (no code). Available in Copilot Studio, Power Apps, Power Automate.
- Supports GPT-4.5, Llama, DeepSeek, Phi-series, and 1,800+ Foundry catalog models
- Image-capable models: Phi-3.5-vision-instruct, Phi-4-multimodal-instruct, Phi-3-vision-128k-instruct, o1, GPT-4o, GPT-4o-mini, GPT-4, GPT-4.5-preview
- Governance: Azure AI Foundry connector in PPAC, DLP policy support
- **~~Preview (Mar 2026):~~ DEPRIORITIZED (Apr 19, 2026):** "Use your own model when generating responses" was **removed from 2025 Wave 2 release plan** — "Deprioritized and will not be delivered" per [2025w2 change-history](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave2/change-history#microsoft-copilot-studio). Feature will NOT be released. For custom-model-driven response generation, use BYOM-for-prompts (GA) in a prompt-based topic/tool, or use an HTTP request action to call your Foundry deployment directly. The existing `nlu-preview-model` path (Microsoft-hosted preview models for generative responses, US-only) remains available.
- No text-to-image model support natively -- use custom action + Azure AI Foundry REST API (e.g., DALL-E 3 via plugin/custom action)

### Government Cloud (GCC/GCC-H/DoD)

**Agent orchestration:**

| Model | Status | Notes |
|-------|--------|-------|
| GPT-4o | Default (GCC) | Only option listed for agent orchestration in government clouds per [MS Learn agent model table](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model) |

**Prompt builder:**

| Model | Status | Notes |
|-------|--------|-------|
| GPT-4o mini | GA (GCC + GCC-H) | Available for prompt builder in gov clouds |
| GPT-4o | GA (GCC + GCC-H) | Available for prompt builder in gov clouds |

**Note:** The agent orchestration government table on MS Learn currently only lists GCC (not GCC-H or DoD). The prompt builder government table lists GCC and GCC-H but not DoD. External model providers (Anthropic, xAI) require admin settings enablement at the tenant level. Cross-geo models may process data outside your region. Government clouds significantly lag behind commercial model availability.

## Model Selection Guidelines

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| **General-purpose agent** | **GPT-5 Auto (recommended default)** | **Dynamically routes between general and reasoning. Best quality for mixed workloads.** |
| General-purpose agent (GA fallback) | GPT-4.1 | Fallback if environment doesn't support preview models. GA everywhere. |
| Simple FAQ / routing | GPT-4.1 | Fast, cost-effective, GA |
| Complex reasoning / analysis | GPT-5 Reasoning (Preview) | Better at multi-step logic, 400K context. Premium rate. |
| Complex reasoning (GA alternative) | Claude Opus 4.6 (GA) | GA deep reasoning, cross-geo. Premium rate. |
| Mixed workloads | GPT-5 Auto (Preview) | Auto-routes between general and reasoning |
| High-quality general | GPT-5 Chat (GA, all regions) | Stronger than 4.1, standard rate. Now GA everywhere. |
| Non-OpenAI preference (general) | Claude Sonnet 4.5 or 4.6 (GA) | Strong GA alternatives, cross-geo |
| Cutting edge (accept experimental risk) | GPT-5.3 Chat / GPT-5.4 Reasoning | Most capable, US early-access only, may have rough edges |
| Cost-sensitive prompts | GPT-4.1 mini (prompt builder) | Basic rate, 128K context |
| Custom/fine-tuned model | BYOM via Azure AI Foundry (prompts only) | GA for prompts. Response-generation BYOM **DEPRIORITIZED Apr 2026** — use HTTP action to call Foundry deployment directly for custom-model response generation. |

## How to Set Model

### Via LSP Wrapper (preferred — headless)
Edit `agent.mcs.yml` → set `aISettings.model.modelNameHint` → `node tools/mcs-lsp.js push`

### Via Island Gateway API
`node tools/island-client.js set-model --env <envId> --bot <botId> --model GPT5Chat`

### Via Playwright (fallback)
1. Navigate to agent Overview page
2. Click the model combobox
3. Select desired model
4. Wait for "completed successfully"

## Credit Rates by Model Tier

| Tier | Models | Rate |
|------|--------|------|
| Basic | GPT-4.1 mini | Basic rate |
| Standard | GPT-4.1, GPT-5 Chat, GPT-5.3 Chat, Claude Sonnet 4.5/4.6 | Standard rate |
| Premium | GPT-5 Reasoning, GPT-5.4 Reasoning, Claude Opus 4.5/4.6/4.7 | Premium rate |

Note: Exact credit-per-token rates vary; see [AI Builder Capability Rate table](https://go.microsoft.com/fwlink/?linkid=2338800) for current pricing.

## Admin Controls

- **Preview/Experimental models**: Admin must enable "Preview and experimental AI models" setting in environment
- **Cross-geo models**: Admin must enable "Move data across regions" in Power Platform admin center
- **External models (Anthropic, xAI)**: Two-step admin enablement -- (1) [turn on external models](https://learn.microsoft.com/en-us/power-platform/admin/allow-llm-generative-responses) in PPAC for the environment or environment group, (2) allow each provider in M365 admin center ([Anthropic](https://learn.microsoft.com/en-us/copilot/microsoft-365/connect-to-ai-subprocessor), [xAI](https://learn.microsoft.com/en-us/copilot/microsoft-365/connect-to-ai-models))
- Preview models and external models are separate settings that can overlap (e.g., block external but allow preview, or vice versa)

## Model Configuration: Separate Settings for Different Purposes

- **Primary agent model**: Controls generative orchestration (agent model dropdown on Overview page). See [authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model).
- **Deep reasoning model**: Separate setting for reasoning-specific tasks (preview). See [authoring-reasoning-models](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-reasoning-models).
- **Generative responses model**: Separate setting for response generation (preview). See [nlu-preview-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/nlu-preview-model). BYOM via Azure AI Foundry also available here (Preview Mar 2026, US only).
- **Prompt builder model**: Separate setting per prompt (prompt-level model selection). See [prompt-model-settings](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-settings).

## Refresh Notes

- Check MCS UI model combobox for new entries (preview/experimental models appear without docs)
- Search "Copilot Studio models" on MS Learn for official updates
- External models (Anthropic, xAI) require tenant admin enablement
- Government clouds lag behind commercial -- check separately
- GPT-4o retired in commercial (Oct 2025) -- still default in GCC/GCC-H/DoD
- Prompt builder has different model lineup AND different status from agent orchestration -- check both pages
- BYOM via Azure AI Foundry: GA for prompts, Preview Mar 2026 for response generation
- **Mar 2026 changes:** GPT-5.2 Chat/Reasoning replaced by GPT-5.3 Chat / GPT-5.4 Reasoning (experimental, US early-access only). Claude Sonnet 4.5, Sonnet 4.6, Opus 4.6 all upgraded to GA globally. GPT-5 Chat now GA in all regions (was EU + US only). Claude Sonnet 4.5 (beta) now available for Computer Use agents (Feb 2026). Claude Opus 4.6 and Claude Sonnet 4.5 now available in prompt builder (Feb 2026).
- **Apr 2026 check:** Model table on MS Learn unchanged from Mar 2026. No new models added to agent orchestration table. GPT-5 Chat confirmed GA globally ("ChatGPT-5 is now generally available globally" per What's New). All Claude models confirmed GA globally. Prompt builder now includes content moderation sensitivity per prompt (Feb 2026). Multi-model "Cowork" feature (GPT drafts, Claude critiques) in Frontier -- this is an M365 Copilot feature, not a Copilot Studio agent feature. Government clouds still GPT-4o only.
- **Apr 13 2026 re-check:** No new models added since Apr 7. Agent orchestration table stable. Prompt builder: GPT-5 reasoning confirmed GA across all regions (via cross-geo). GPT-5.2 chat/reasoning still experimental US-only in prompt builder. Government cloud agent orchestration table on MS Learn now only shows GCC (not GCC-H/DoD) for GPT-4o -- possible doc simplification or scope reduction. Copilot Studio application card now references "GPT-5 series", "Claude Sonnet 4", and "Grok 4.1 Fast" as the foundation models powering the service. Model use category descriptions clarified: Deep (multistep, tool-rich), Auto (adaptive per turn), General (shallow-to-moderate reasoning). Admin controls doc clarified two-step process for external models: (1) PPAC environment setting, (2) M365 admin center per-provider allowlisting.
- **Apr 22 2026 re-check:** New experimental model **Claude Opus 4.7** (Deep) added to agent orchestration Apr 16, 2026 (same day as GitHub Copilot / M365 Copilot rollout). Experimental in US natively + cross-geo in all other regions. First Claude model with high-resolution image support. Two-step admin enablement (preview/experimental + external models + cross-geo). **BYOM for response generation DEPRIORITIZED Apr 19, 2026** per 2025w2 change-history — will NOT be delivered. Use BYOM-for-prompts + HTTP action as workaround. Prompt builder model lineup confirmed (Claude Sonnet 4.5/4.6, Claude Opus 4.6 experimental). Government cloud table still GPT-4o only for agent orchestration.
- **Apr 27 2026 re-check:** authoring-select-agent-model doc last-modified 2026-04-25 now includes **GPT-5.5 Reasoning** (Deep) in Experimental (early access environment) US-only — added to public availability table alongside GPT-5.3 Chat / GPT-5.4 Reasoning. No other model lineup changes. Government clouds still GPT-4o only. Public availability table now lists 9 models in the public table: GPT-4o (Retired), GPT-4.1 (Default), GPT-5 Chat (GA), GPT-5 Reasoning (Preview), GPT-5 Auto (Preview), GPT-5.3 Chat (Experimental), GPT-5.4 Reasoning (Experimental), GPT-5.5 Reasoning (Experimental), Claude Sonnet 4.5/4.6 (GA), Claude Opus 4.6 (GA), Claude Opus 4.7 (Experimental), Grok 4.1 Fast (Experimental). Whats-new doc reaffirms Mar 2026 GA milestones (GPT-5 Chat global, Claude Sonnet 4.5/4.6/Opus 4.6 global). No prompt-builder model changes since Apr 22. BYOM-for-response-generation status unchanged (deprioritized).
