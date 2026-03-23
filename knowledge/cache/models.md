<!-- CACHE METADATA
last_verified: 2026-03-23
sources: [MS Learn (authoring-select-agent-model, prompt-model-settings, prompt-model-availability, planned-features, bring-your-own-model-prompts, authoring-select-external-response-model, release-plan/2026wave1), MCS UI snapshot, WebSearch Mar 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Available Models

## Models Available in MCS (Mar 2026)

### Model Categories

| Category | Purpose | Examples |
|----------|---------|---------|
| **General** | Everyday chat, FAQ, routing | GPT-4.1, GPT-5 Chat, Claude Sonnet 4.5, Claude Sonnet 4.6 |
| **Deep** | Complex reasoning, multi-step analysis | GPT-5 Reasoning, Claude Opus 4.6, GPT-5.4 Reasoning |
| **Auto** | Mixed workloads -- routes dynamically between general and reasoning | GPT-5 Auto |
| **Mini** | Cost-effective, moderate complexity | GPT-4.1 mini (prompt builder only) |

### Primary Agent Model Lineup (agent orchestration)

Source: [MS Learn authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model)

| Model | Category | Status | Availability | Notes |
|-------|----------|--------|-------------|-------|
| GPT-4o | General | **RETIRED** | All regions | Replaced by GPT-4.1 (Oct 2025). 1-month grace period expired. |
| **GPT-4.1** | General | **GA (Default)** | All regions | Default model for all new agents |
| **GPT-5 Chat** | General | **GA** | All regions | Standard rate. Now GA everywhere (previously EU + US only). |
| **GPT-5 Reasoning** | Deep | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Premium rate, 400K context |
| **GPT-5 Auto** | Auto | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Dynamically routes between general and reasoning |
| GPT-5.3 Chat | General | **Experimental** | **US only** (early access environment) | Next-gen general. Replaced GPT-5.2 Chat in model table. |
| GPT-5.4 Reasoning | Deep | **Experimental** | **US only** (early access environment) | Next-gen reasoning. Replaced GPT-5.2 Reasoning in model table. |
| **Claude Sonnet 4.5** | General | **GA** | GA (cross-geo) all regions; GA natively in US | Anthropic model, requires admin enablement. Upgraded from Preview to GA. |
| **Claude Sonnet 4.6** | General | **GA** | GA (cross-geo) all regions; GA natively in US | Anthropic model. Upgraded from Experimental to GA. |
| **Claude Opus 4.6** | Deep | **GA** | GA (cross-geo) all regions; GA natively in US | Anthropic deep reasoning. Upgraded from Experimental to GA. |
| Grok 4.1 Fast | General | **Experimental** | **US only** (early access environment) | xAI model. Higher harmful content risk per MS safety eval. Non-reasoning. |

### Prompt Builder Model Lineup (AI Builder prompts in MCS / Power Apps / Power Automate)

Source: [MS Learn prompt-model-settings](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-settings)

| Model | Category | Licensing | Context | Notes |
|-------|----------|-----------|---------|-------|
| **GPT-4.1 mini** | Mini | Basic rate | 128K | Default for prompt builder |
| **GPT-4.1** | General | Standard rate | 128K | |
| **GPT-5 chat** | General | Standard rate | 128K | GA |
| **GPT-5 reasoning** | Deep | Premium rate | 400K | GA |
| GPT-5.2 chat | General | Standard rate | 128K | Experimental |
| GPT-5.2 reasoning | Deep | Premium rate | 400K | Experimental |
| Claude Sonnet 4.5 | General | Standard rate | 200K | Experimental (note: GA for agent orchestration, but experimental for prompt builder) |
| Claude Opus 4.5 | Deep | Premium rate | 200K | Experimental |

**Retired models (prompt builder):** Claude Opus 4.1 (retired Feb 2026, replaced by Claude Opus 4.5), o3 (retired Dec 2025, replaced by GPT-5 reasoning), GPT-4o mini/GPT-4o (retired Jul 2025).

**Note:** Prompt builder has a DIFFERENT model lineup and status from agent orchestration. Claude models are "experimental" in prompt builder but "GA" in agent orchestration. GPT-5.2 is still listed in prompt builder but replaced by GPT-5.3/5.4 in agent orchestration. Claude Sonnet 4.5 / Opus 4.5 in prompt builder are unavailable in Asia region but experimental everywhere else (per [prompt-model-availability](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-availability)).

### Bring Your Own Model (BYOM) -- GA for prompts, Preview for response generation (Mar 2026)

Source: [MS Learn bring-your-own-model-prompts](https://learn.microsoft.com/en-us/microsoft-copilot-studio/bring-your-own-model-prompts), [MS Learn release plan](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave2/microsoft-copilot-studio/use-own-model-when-generating-responses)

- **GA for prompts:** Connect Azure AI Foundry models into agent prompts (no code). Available in Copilot Studio, Power Apps, Power Automate.
- Supports GPT-4.5, Llama, DeepSeek, Phi-series, and 1,800+ Foundry catalog models
- Image-capable models: Phi-3.5-vision-instruct, Phi-4-multimodal-instruct, Phi-3-vision-128k-instruct, o1, GPT-4o, GPT-4o-mini, GPT-4, GPT-4.5-preview
- Governance: Azure AI Foundry connector in PPAC, DLP policy support
- **Preview (Mar 2026):** "Use your own model when generating responses" -- replace the default response model in agent settings with a custom Azure AI Foundry deployment (not just prompts)
- No text-to-image model support natively -- use custom action + Azure AI Foundry REST API

### Government Cloud (GCC/GCC-H/DoD)

| Model | Status | Notes |
|-------|--------|-------|
| GPT-4o | Default (GCC + GCC-H + DoD) | Still the only option for agent orchestration in government clouds |
| GPT-4o mini | GA (GCC + GCC-H) | Available for prompt builder in gov clouds |

**Note:** DoD now lists GPT-4o as Default (per MS Learn table update). External model providers (Anthropic, xAI) require admin settings enablement at the tenant level. Cross-geo models may process data outside your region. Government clouds significantly lag behind commercial model availability.

## Model Selection Guidelines

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| General-purpose agent | GPT-4.1 (default) | Best balance of capability, speed, and cost. GA everywhere. |
| Simple FAQ / routing | GPT-4.1 | Fast, cost-effective, GA |
| Complex reasoning / analysis | GPT-5 Reasoning (Preview) | Better at multi-step logic, 400K context. Premium rate. |
| Complex reasoning (GA alternative) | Claude Opus 4.6 (GA) | GA deep reasoning, cross-geo. Premium rate. |
| Mixed workloads | GPT-5 Auto (Preview) | Auto-routes between general and reasoning |
| High-quality general | GPT-5 Chat (GA, all regions) | Stronger than 4.1, standard rate. Now GA everywhere. |
| Non-OpenAI preference (general) | Claude Sonnet 4.5 or 4.6 (GA) | Strong GA alternatives, cross-geo |
| Cutting edge (accept experimental risk) | GPT-5.3 Chat / GPT-5.4 Reasoning | Most capable, US early-access only, may have rough edges |
| Cost-sensitive prompts | GPT-4.1 mini (prompt builder) | Basic rate, 128K context |
| Custom/fine-tuned model | BYOM via Azure AI Foundry | Prompt-level only (GA). Response generation preview Mar 2026. |

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
| Premium | GPT-5 Reasoning, GPT-5.4 Reasoning, Claude Opus 4.5/4.6 | Premium rate |

Note: Exact credit-per-token rates vary; see [AI Builder Capability Rate table](https://go.microsoft.com/fwlink/?linkid=2338800) for current pricing.

## Admin Controls

- **Preview/Experimental models**: Admin must enable "Preview and experimental AI models" setting in environment
- **Cross-geo models**: Admin must enable "Move data across regions" in Power Platform admin center
- **External models (Anthropic, xAI)**: Two-step admin enablement -- (1) turn on external models in PPAC for environment, (2) allow each provider in M365 admin center
- Preview models and external models are separate settings that can overlap

## Model Configuration: Separate Settings for Different Purposes

- **Primary agent model**: Controls generative orchestration (agent model dropdown on Overview page)
- **Deep reasoning model**: Separate setting for reasoning-specific tasks (preview)
- **Generative responses model**: Separate setting for response generation (preview)
- **Prompt builder model**: Separate setting per prompt (prompt-level model selection)

## Refresh Notes

- Check MCS UI model combobox for new entries (preview/experimental models appear without docs)
- Search "Copilot Studio models" on MS Learn for official updates
- External models (Anthropic, xAI) require tenant admin enablement
- Government clouds lag behind commercial -- check separately
- GPT-4o retired in commercial (Oct 2025) -- still default in GCC/GCC-H/DoD
- Prompt builder has different model lineup AND different status from agent orchestration -- check both pages
- BYOM via Azure AI Foundry: GA for prompts, Preview Mar 2026 for response generation
- **Mar 2026 changes:** GPT-5.2 Chat/Reasoning replaced by GPT-5.3 Chat / GPT-5.4 Reasoning (experimental, US early-access only). Claude Sonnet 4.5, Sonnet 4.6, Opus 4.6 all upgraded to GA. GPT-5 Chat now GA in all regions (was EU + US only).
